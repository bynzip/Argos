from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.models import Notification
from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer, Device
from apps.tickets.models import Ticket, TicketChecklistItem


PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0bIDAT\x08\xd7c\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xd9'
    b'\x98\x8f\x00\x00\x00\x00IEND\xaeB`\x82'
)
JPEG_BYTES = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9'


class TicketFlowTests(APITestCase):
    def setUp(self):
        self.receptionist = create_user_with_role(
            'recep',
            'Recepcionista',
            ['tickets.create', 'tickets.transition_reception', 'tickets.view_list', 'tickets.view_detail']
        )
        self.technician = create_user_with_role(
            'tech',
            'Tecnico',
            ['tickets.view_own', 'tickets.view_detail', 'tickets.transition_technical']
        )
        self.customer = Customer.objects.create(
            identificador='12345678',
            nombre='Cliente Uno',
            tipo_cliente='PERSONA'
        )
        self.other_customer = Customer.objects.create(
            identificador='87654321',
            nombre='Cliente Dos',
            tipo_cliente='PERSONA'
        )
        self.device = Device.objects.create(
            customer=self.other_customer,
            tipo_equipo='Laptop',
            marca='Lenovo',
            modelo='T14'
        )

    def test_cannot_create_ticket_with_device_from_another_customer(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post('/api/tickets/', {
            'customer_id': self.customer.id,
            'device_id': self.device.id,
            'descripcion_problema': 'No enciende',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_receptionist_cannot_do_technical_transition(self):
        ticket = Ticket.objects.create(
            folio='TKT-2025-0001',
            customer=self.customer,
            descripcion_problema='No enciende',
            created_by=self.receptionist,
            estado=Ticket.TicketStatus.INTAKE
        )
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(f'/api/tickets/{ticket.id}/transition/', {
            'new_status': Ticket.TicketStatus.DIAGNOSTIC
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_can_create_ticket_without_images(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            '/api/tickets/',
            {
                'customer_id': self.customer.id,
                'descripcion_problema': 'No enciende',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['evidences']), 0)

    def test_can_create_ticket_with_valid_images(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            '/api/tickets/',
            {
                'customer_id': self.customer.id,
                'descripcion_problema': 'Pantalla dañada',
                'evidences': [
                    SimpleUploadedFile('equipo-1.png', PNG_BYTES, content_type='image/png'),
                    SimpleUploadedFile('equipo-2.jpg', JPEG_BYTES, content_type='image/jpeg'),
                ],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['evidences']), 2)

    def test_rejects_invalid_ticket_evidence_type(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            '/api/tickets/',
            {
                'customer_id': self.customer.id,
                'descripcion_problema': 'No enciende',
                'evidences': [
                    SimpleUploadedFile('manual.pdf', b'%PDF-1.4', content_type='application/pdf'),
                ],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('JPG o PNG', str(response.data))

    def test_rejects_more_than_fifteen_ticket_evidences(self):
        self.client.force_authenticate(self.receptionist)
        files = [
            SimpleUploadedFile(f'evidence-{index}.png', PNG_BYTES, content_type='image/png')
            for index in range(16)
        ]
        response = self.client.post(
            '/api/tickets/',
            {
                'customer_id': self.customer.id,
                'descripcion_problema': 'No enciende',
                'evidences': files,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hasta 15 evidencias', str(response.data))

    def test_rejects_oversized_ticket_evidence(self):
        self.client.force_authenticate(self.receptionist)
        oversized_file = SimpleUploadedFile(
            'oversized.png',
            b'a' * ((5 * 1024 * 1024) + 1),
            content_type='image/png',
        )
        response = self.client.post(
            '/api/tickets/',
            {
                'customer_id': self.customer.id,
                'descripcion_problema': 'No enciende',
                'evidences': [oversized_file],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('5 MB', str(response.data))

    def test_can_complete_checklist_item_with_evidence(self):
        checklist_user = create_user_with_role(
            'tech_checklist',
            'Tecnico',
            ['tickets.view_own', 'tickets.view_detail', 'tickets.transition_technical'],
        )
        ticket = Ticket.objects.create(
            folio='TKT-2025-0002',
            customer=self.customer,
            descripcion_problema='No enciende',
            created_by=self.receptionist,
            assigned_to=checklist_user,
            estado=Ticket.TicketStatus.IN_REPAIR,
        )
        checklist_item = TicketChecklistItem.objects.create(ticket=ticket, nombre='Prueba final', requerido=True)

        self.client.force_authenticate(checklist_user)
        response = self.client.patch(
            f'/api/tickets/{ticket.id}/checklist-items/{checklist_item.id}/',
            {
                'completado': 'true',
                'evidences': [SimpleUploadedFile('prueba.png', PNG_BYTES, content_type='image/png')],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        checklist_item.refresh_from_db()
        self.assertTrue(checklist_item.completado)
        self.assertEqual(checklist_item.evidences.count(), 1)

    def test_ready_transition_creates_notification_for_reception(self):
        ready_technician = create_user_with_role(
            'tech_ready',
            'Tecnico',
            ['tickets.view_own', 'tickets.view_detail', 'tickets.transition_technical'],
        )
        reception_target = create_user_with_role(
            'recep_ready',
            'Recepcionista',
            ['tickets.view_list', 'tickets.view_detail'],
        )
        ticket = Ticket.objects.create(
            folio='TKT-2025-0003',
            customer=self.customer,
            descripcion_problema='No enciende',
            created_by=self.receptionist,
            assigned_to=ready_technician,
            estado=Ticket.TicketStatus.IN_TESTING,
            total='120.00',
        )
        TicketChecklistItem.objects.create(
            ticket=ticket,
            nombre='Checklist completo',
            requerido=True,
            completado=True,
            completado_por=ready_technician,
        )

        self.client.force_authenticate(ready_technician)
        response = self.client.post(
            f'/api/tickets/{ticket.id}/transition/',
            {'new_status': Ticket.TicketStatus.READY},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            Notification.objects.filter(
                user=reception_target,
                message__icontains=ticket.folio,
            ).filter(message__icontains='Saldo pendiente').exists()
        )
