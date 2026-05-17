from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Notification
from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer
from apps.finance.models import CashClosure, Receipt
from apps.tickets.models import Ticket


PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0bIDAT\x08\xd7c\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xd9'
    b'\x98\x8f\x00\x00\x00\x00IEND\xaeB`\x82'
)


class FinanceFlowTests(APITestCase):
    def setUp(self):
        self.receptionist = create_user_with_role(
            'recep_fin',
            'Recepcionista',
            ['finance.view_cash', 'finance.open_close_cash', 'finance.register_payment', 'finance.view_receipts']
        )
        self.admin = create_user_with_role(
            'admin_fin',
            'Administrador',
            ['finance.confirm_payment', 'finance.view_receipts']
        )
        self.customer = Customer.objects.create(
            identificador='12341234',
            nombre='Cliente Pago',
            tipo_cliente='PERSONA'
        )
        self.ticket = Ticket.objects.create(
            folio='TKT-2025-1000',
            customer=self.customer,
            descripcion_problema='Equipo lento',
            total=Decimal('100.00'),
            created_by=self.receptionist,
        )

    def open_cash(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post('/api/finance/caja/abrir/', {'opening_amount': '50.00'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cannot_register_payment_without_open_cash(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {'amount': '10.00', 'metodo_pago': 'CASH'},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cash_payment_is_confirmed_and_reduces_balance(self):
        self.open_cash()
        response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {'amount': '40.00', 'metodo_pago': 'CASH'},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.ticket.refresh_from_db()
        self.assertEqual(response.data['estado'], Receipt.ReceiptStatus.CONFIRMED)
        self.assertEqual(self.ticket.saldo_pendiente, Decimal('60.00'))

    def test_digital_payment_stays_pending_until_confirmed(self):
        self.open_cash()
        voucher = SimpleUploadedFile('voucher.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {
                'amount': '30.00',
                'metodo_pago': 'YAPE',
                'referencia': 'ABC123',
                'voucher_file': voucher,
            },
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.ticket.refresh_from_db()
        self.assertEqual(response.data['estado'], Receipt.ReceiptStatus.PENDING)
        self.assertEqual(self.ticket.saldo_pendiente, Decimal('100.00'))

    def test_duplicate_voucher_is_rejected(self):
        self.open_cash()
        first_voucher = SimpleUploadedFile('voucher.png', PNG_BYTES, content_type='image/png')
        second_voucher = SimpleUploadedFile('voucher2.png', PNG_BYTES, content_type='image/png')

        first_response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {
                'amount': '20.00',
                'metodo_pago': 'YAPE',
                'referencia': 'REF1',
                'voucher_file': first_voucher,
            },
            format='multipart'
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        second_response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {
                'amount': '20.00',
                'metodo_pago': 'PLIN',
                'referencia': 'REF2',
                'voucher_file': second_voucher,
            },
            format='multipart'
        )
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_confirm_pending_payment(self):
        self.open_cash()
        voucher = SimpleUploadedFile('voucher.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {
                'amount': '30.00',
                'metodo_pago': 'YAPE',
                'referencia': 'ABC123',
                'voucher_file': voucher,
            },
            format='multipart'
        )
        receipt_id = response.data['id']

        self.client.force_authenticate(self.admin)
        confirm_response = self.client.post(f'/api/finance/pagos/{receipt_id}/confirm/')
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.saldo_pendiente, Decimal('70.00'))

    def test_cannot_close_cash_with_pending_receipts(self):
        self.open_cash()
        voucher = SimpleUploadedFile('voucher.png', PNG_BYTES, content_type='image/png')
        self.client.post(
            f'/api/finance/tickets/{self.ticket.id}/pagos/',
            {
                'amount': '30.00',
                'metodo_pago': 'YAPE',
                'referencia': 'PEND-001',
                'voucher_file': voucher,
            },
            format='multipart'
        )

        response = self.client.post('/api/finance/caja/cerrar/', {'declared_amount': '50.00'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pagos digitales pendientes', str(response.data))

    def test_cannot_close_cash_with_difference_without_note(self):
        self.open_cash()

        response = self.client.post('/api/finance/caja/cerrar/', {'declared_amount': '40.00'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nota de cierre', str(response.data))
        self.assertTrue(CashClosure.objects.filter(user=self.receptionist, estado=CashClosure.Status.OPEN).exists())

    def test_close_cash_with_difference_and_note_notifies_admin(self):
        self.open_cash()

        response = self.client.post(
            '/api/finance/caja/cerrar/',
            {'declared_amount': '40.00', 'notes': 'Faltante detectado en conteo final'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['difference'], '-10.00')
        self.assertTrue(
            Notification.objects.filter(
                user=self.admin,
                message__icontains='diferencia de S/ -10.00',
            ).exists()
        )
