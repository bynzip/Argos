from decimal import Decimal

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer
from apps.products.models import InventoryMovement, Product, StockItem, StockReservation, Warehouse
from apps.tickets.models import Ticket
from apps.tickets.services.ticket_service import transition_ticket


class InventoryFlowTests(APITestCase):
    def setUp(self):
        self.inventory_user = create_user_with_role(
            'alm_inv',
            'Almacenero',
            [
                'inventory.view_catalog',
                'inventory.view_stock',
                'inventory.reserve_stock',
                'inventory.adjust_stock',
                'inventory.transfer_stock',
                'inventory.manage_movements',
            ],
        )
        self.receptionist = create_user_with_role(
            'recep_inv',
            'Recepcionista',
            ['tickets.transition_reception'],
        )
        self.client.force_authenticate(self.inventory_user)

        self.customer = Customer.objects.create(
            identificador='44556677',
            nombre='Cliente Inventario',
            tipo_cliente='PERSONA',
        )
        self.ticket = Ticket.objects.create(
            folio='TKT-INV-0001',
            customer=self.customer,
            descripcion_problema='Cambio de teclado',
            created_by=self.inventory_user,
            estado=Ticket.TicketStatus.APPROVED,
            total=Decimal('150.00'),
        )
        self.product = Product.objects.create(
            codigo='PROD-INV-01',
            nombre='Teclado Laptop',
            precio_costo='50.00',
            precio_venta='80.00',
            stock_minimo=2,
        )
        self.secondary_warehouse = Warehouse.objects.create(nombre='Secundario', ubicacion='B2')
        self.warehouse = Warehouse.objects.create(nombre='Principal', ubicacion='A1')
        self.stock_item = StockItem.objects.create(
            product=self.product,
            warehouse=self.warehouse,
            cantidad=Decimal('5.000'),
            reservado=Decimal('0.000'),
            costo_promedio=Decimal('40.0000'),
        )

    def test_create_reservation_updates_reserved_stock(self):
        response = self.client.post('/api/products/reservations/', {
            'ticket_id': self.ticket.id,
            'stock_item_id': self.stock_item.id,
            'cantidad': '2.000',
            'notas': 'Reserva inicial',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.stock_item.refresh_from_db()
        self.assertEqual(self.stock_item.reservado, Decimal('2.000'))
        self.assertEqual(self.stock_item.disponible, Decimal('3.000'))

    def test_cannot_reserve_more_than_available(self):
        response = self.client.post('/api/products/reservations/', {
            'ticket_id': self.ticket.id,
            'stock_item_id': self.stock_item.id,
            'cantidad': '8.000',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cantidad', response.data)

    def test_release_reservation_restores_available_stock(self):
        reservation = StockReservation.objects.create(
            stock_item=self.stock_item,
            ticket=self.ticket,
            cantidad=Decimal('1.500'),
            reservado_por=self.inventory_user,
        )
        self.stock_item.reservado = Decimal('1.500')
        self.stock_item.save(update_fields=['reservado', 'updated_at'])

        response = self.client.post(f'/api/products/reservations/{reservation.id}/release/', {'notas': 'Cambio de decisión'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stock_item.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(self.stock_item.reservado, Decimal('0.000'))
        self.assertEqual(reservation.estado, StockReservation.ReservationStatus.RELEASED)

    def test_consume_reservation_reduces_physical_stock_and_logs_kardex(self):
        reservation = StockReservation.objects.create(
            stock_item=self.stock_item,
            ticket=self.ticket,
            cantidad=Decimal('2.000'),
            reservado_por=self.inventory_user,
        )
        self.stock_item.reservado = Decimal('2.000')
        self.stock_item.save(update_fields=['reservado', 'updated_at'])

        response = self.client.post(f'/api/products/reservations/{reservation.id}/consume/', {'notas': 'Instalado'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stock_item.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(self.stock_item.cantidad, Decimal('3.000'))
        self.assertEqual(self.stock_item.reservado, Decimal('0.000'))
        self.assertEqual(reservation.estado, StockReservation.ReservationStatus.CONSUMED)
        self.assertTrue(
            InventoryMovement.objects.filter(
                product=self.product,
                warehouse=self.warehouse,
                movement_type=InventoryMovement.MovementType.EXIT,
                reference_id=str(self.ticket.id),
            ).exists()
        )

    def test_adjust_and_transfer_create_tracked_movements(self):
        adjust_response = self.client.post('/api/products/movements/adjust/', {
            'stock_item': self.stock_item.id,
            'movement_type': InventoryMovement.MovementType.ADJUSTMENT_IN,
            'quantity': '2.000',
            'notes': 'Conteo corregido',
            'unit_cost': '45.2500',
        }, format='json')
        self.assertEqual(adjust_response.status_code, status.HTTP_200_OK)

        transfer_response = self.client.post('/api/products/movements/transfer/', {
            'source_stock_item': self.stock_item.id,
            'destination_warehouse': self.secondary_warehouse.id,
            'quantity': '1.000',
            'notes': 'Mover a secundario',
        }, format='json')
        self.assertEqual(transfer_response.status_code, status.HTTP_200_OK)

        self.stock_item.refresh_from_db()
        destination = StockItem.objects.get(product=self.product, warehouse=self.secondary_warehouse)
        self.assertEqual(self.stock_item.cantidad, Decimal('6.000'))
        self.assertEqual(destination.cantidad, Decimal('1.000'))
        self.assertEqual(
            InventoryMovement.objects.filter(product=self.product).count(),
            3,
        )

    def test_ticket_cannot_be_delivered_with_active_reservations(self):
        StockReservation.objects.create(
            stock_item=self.stock_item,
            ticket=self.ticket,
            cantidad=Decimal('1.000'),
            reservado_por=self.inventory_user,
        )
        self.stock_item.reservado = Decimal('1.000')
        self.stock_item.save(update_fields=['reservado', 'updated_at'])
        self.ticket.estado = Ticket.TicketStatus.READY
        self.ticket.save(update_fields=['estado', 'updated_at'])

        with self.assertRaises(ValidationError):
            transition_ticket(
                ticket=self.ticket,
                new_status=Ticket.TicketStatus.DELIVERED,
                user=self.receptionist,
                motivo='Intento de entrega',
            )
