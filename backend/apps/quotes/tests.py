from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import CompanyProfile
from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer, Device
from apps.quotes.models import Quote
from apps.services.models import Service
from apps.tickets.models import Ticket
from apps.tickets.services.ticket_service import create_ticket


class QuoteFlowTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_role(
            'recep',
            'Recepcionista',
            [
                'quotes.view_list',
                'quotes.view_detail',
                'quotes.create',
                'quotes.send',
                'quotes.approve',
                'quotes.reject',
                'quotes.convert_to_ticket',
            ],
        )
        self.admin = create_user_with_role(
            'admin_quotes',
            'Administrador',
            ['quotes.approve_multinivel'],
        )
        self.client.force_authenticate(self.user)

        self.customer = Customer.objects.create(
            tipo_cliente='PERSONA',
            identificador='12345678',
            nombre='Cliente Test',
        )
        self.device = Device.objects.create(
            customer=self.customer,
            tipo_equipo='Laptop',
            marca='Dell',
            modelo='Latitude',
        )
        self.service = Service.objects.create(
            codigo='SRV-TEST-0001',
            nombre='Diagnóstico avanzado',
            precio_base=Decimal('120.00'),
        )
        CompanyProfile.objects.create(
            business_name='Argos',
            ruc='12345678901',
            phone='999999999',
            email='admin@argos.local',
            quote_default_validity_days=15,
            quote_default_igv=Decimal('18.00'),
            quote_approval_threshold_amount=Decimal('1000.00'),
        )

    def _quote_payload(self, **overrides):
        payload = {
            'customer': self.customer.id,
            'device': self.device.id,
            'quote_type': 'REPAIR',
            'descuento': '0.00',
            'igv_rate': '18.00',
            'notas': 'Notas de prueba',
            'lines': [
                {
                    'line_type': 'SERVICE',
                    'service': self.service.id,
                    'descripcion': 'Servicio técnico',
                    'cantidad': '1',
                    'precio_unitario': '120.00',
                    'descuento_linea': '0.00',
                }
            ],
        }
        payload.update(overrides)
        return payload

    def test_create_linked_quote_keeps_ticket_and_quote_in_draft(self):
        ticket = create_ticket(
            customer=self.customer,
            user=self.user,
            descripcion_problema='No enciende',
            device=self.device,
        )
        ticket.estado = Ticket.TicketStatus.DIAGNOSTIC
        ticket.save(update_fields=['estado', 'updated_at'])

        response = self.client.post('/api/quotes/', self._quote_payload(source_ticket=str(ticket.id)), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['estado'], Quote.QuoteStatus.DRAFT)
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, Ticket.TicketStatus.DIAGNOSTIC)

    def test_send_linked_quote_moves_ticket_to_quoted(self):
        ticket = create_ticket(
            customer=self.customer,
            user=self.user,
            descripcion_problema='No enciende',
            device=self.device,
        )
        ticket.estado = Ticket.TicketStatus.DIAGNOSTIC
        ticket.save(update_fields=['estado', 'updated_at'])
        create_response = self.client.post('/api/quotes/', self._quote_payload(source_ticket=str(ticket.id)), format='json')

        send_response = self.client.post(f"/api/quotes/{create_response.data['id']}/send/")

        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, Ticket.TicketStatus.QUOTED)

    def test_quote_above_threshold_requires_admin_approval_before_send(self):
        ticket = create_ticket(
            customer=self.customer,
            user=self.user,
            descripcion_problema='No enciende',
            device=self.device,
        )
        ticket.estado = Ticket.TicketStatus.DIAGNOSTIC
        ticket.save(update_fields=['estado', 'updated_at'])

        create_response = self.client.post(
            '/api/quotes/',
            self._quote_payload(
                source_ticket=str(ticket.id),
                lines=[
                    {
                        'line_type': 'SERVICE',
                        'service': self.service.id,
                        'descripcion': 'Servicio premium',
                        'cantidad': '10',
                        'precio_unitario': '120.00',
                        'descuento_linea': '0.00',
                    }
                ],
            ),
            format='json'
        )
        quote_id = create_response.data['id']

        send_response = self.client.post(f'/api/quotes/{quote_id}/send/')
        self.assertEqual(send_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.admin)
        approve_response = self.client.post(f'/api/quotes/{quote_id}/approve_amount/')
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.user)
        send_after_approval = self.client.post(f'/api/quotes/{quote_id}/send/')
        self.assertEqual(send_after_approval.status_code, status.HTTP_200_OK)

    def test_sent_quote_cannot_be_edited(self):
        create_response = self.client.post('/api/quotes/', self._quote_payload(), format='json')
        quote_id = create_response.data['id']
        self.client.post(f'/api/quotes/{quote_id}/send/')

        update_response = self.client.patch(
            f'/api/quotes/{quote_id}/',
            self._quote_payload(notas='Cambio tardío'),
            format='json'
        )
        self.assertEqual(update_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_new_version_deactivates_previous_quote(self):
        create_response = self.client.post('/api/quotes/', self._quote_payload(), format='json')
        quote_id = create_response.data['id']

        version_response = self.client.post(f'/api/quotes/{quote_id}/new_version/')
        self.assertEqual(version_response.status_code, status.HTTP_201_CREATED)

        previous = Quote.objects.get(pk=quote_id)
        current = Quote.objects.get(pk=version_response.data['id'])
        self.assertFalse(previous.is_active_version)
        self.assertTrue(current.is_active_version)
        self.assertEqual(current.version, 2)

    def test_direct_quote_can_convert_to_ticket_after_approval(self):
        create_response = self.client.post(
            '/api/quotes/',
            self._quote_payload(device=None, quote_type='DIRECT'),
            format='json',
        )
        quote_id = create_response.data['id']
        self.client.post(f'/api/quotes/{quote_id}/send/')
        self.client.post(f'/api/quotes/{quote_id}/approve/')

        convert_response = self.client.post(f'/api/quotes/{quote_id}/convert_to_ticket/')
        self.assertEqual(convert_response.status_code, status.HTTP_201_CREATED)
        ticket = Ticket.objects.get(pk=convert_response.data['ticket_id'])
        self.assertEqual(ticket.estado, Ticket.TicketStatus.APPROVED)

    def test_quote_pdf_download_returns_pdf_file(self):
        create_response = self.client.post('/api/quotes/', self._quote_payload(), format='json')
        quote_id = create_response.data['id']

        response = self.client.get(f'/api/quotes/{quote_id}/download-pdf/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('.pdf', response['Content-Disposition'])
        self.assertTrue(response.content.startswith(b'%PDF-1.4'))

    def test_rejects_decimal_line_quantity(self):
        response = self.client.post(
            '/api/quotes/',
            self._quote_payload(
                lines=[
                    {
                        'line_type': 'SERVICE',
                        'service': self.service.id,
                        'descripcion': 'Servicio técnico',
                        'cantidad': '1.5',
                        'precio_unitario': '120.00',
                        'descuento_linea': '0.00',
                    }
                ],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cantidad entera positiva', str(response.data))

    def test_rejects_negative_discount(self):
        response = self.client.post(
            '/api/quotes/',
            self._quote_payload(descuento='-5.00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('descuento no puede ser negativo', str(response.data))

    def test_receptionist_cannot_apply_direct_discounts(self):
        response = self.client.post(
            '/api/quotes/',
            self._quote_payload(descuento='10.00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('no puede aplicar descuentos directamente', str(response.data))

    def test_approved_quote_cannot_be_edited(self):
        create_response = self.client.post('/api/quotes/', self._quote_payload(), format='json')
        quote_id = create_response.data['id']
        self.client.post(f'/api/quotes/{quote_id}/send/')
        self.client.post(f'/api/quotes/{quote_id}/approve/')

        update_response = self.client.patch(
            f'/api/quotes/{quote_id}/',
            self._quote_payload(descuento='0.00'),
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_400_BAD_REQUEST)
