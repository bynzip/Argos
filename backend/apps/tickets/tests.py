from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer, Device
from apps.tickets.models import Ticket


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
