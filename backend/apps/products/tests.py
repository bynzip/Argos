from decimal import Decimal

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Notification
from apps.core.test_utils import create_user_with_role
from apps.customers.models import Customer
from apps.products.models import InventoryMovement, Product, StockItem, StockReservation, Warehouse
from apps.quotes.models import Quote, QuoteLine
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
        self.quote = Quote.objects.create(
            folio='COT-INV-0001',
            customer=self.customer,
            source_ticket=self.ticket,
            created_by=self.inventory_user,
            estado=Quote.QuoteStatus.DRAFT,
            descuento=Decimal('0.00'),
            igv_rate=Decimal('18.00'),
            subtotal=Decimal('0.00'),
            igv_amount=Decimal('0.00'),
            total=Decimal('0.00'),
        )
        self.quote.base_quote = self.quote
        self.quote.save(update_fields=['base_quote'])
        self.quote_line = QuoteLine.objects.create(
            quote=self.quote,
            line_type=QuoteLine.LineType.PRODUCT,
            product=self.product,
            descripcion='Teclado Laptop',
            cantidad=Decimal('8.000'),
            precio_unitario=Decimal('80.00'),
            descuento_linea=Decimal('0.00'),
            total_linea=Decimal('640.00'),
            supply_status=QuoteLine.SupplyStatus.NOT_APPLICABLE,
            orden=0,
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

    def test_partial_reservation_marks_ticket_waiting_parts_and_pending_order(self):
        response = self.client.post('/api/products/reservations/', {
            'ticket_id': self.ticket.id,
            'stock_item_id': self.stock_item.id,
            'cantidad': '8.000',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['was_partial'])
        self.assertEqual(response.data['requested_quantity'], '8.000')
        self.assertEqual(response.data['missing_quantity'], '3.000')
        self.ticket.refresh_from_db()
        self.quote_line.refresh_from_db()
        self.assertEqual(self.ticket.estado, Ticket.TicketStatus.WAITING_PARTS)
        self.assertEqual(self.quote_line.supply_status, QuoteLine.SupplyStatus.PENDING_ORDER)
        self.assertTrue(
            self.ticket.transitions.filter(
                estado_nuevo=Ticket.TicketStatus.WAITING_PARTS,
                fue_automatico=True,
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.inventory_user,
                message__icontains=self.ticket.folio,
            ).filter(message__icontains='Falta stock').exists()
        )

    def test_zero_stock_reservation_returns_error_and_marks_out_of_stock(self):
        self.stock_item.cantidad = Decimal('0.000')
        self.stock_item.save(update_fields=['cantidad', 'updated_at'])

        response = self.client.post('/api/products/reservations/', {
            'ticket_id': self.ticket.id,
            'stock_item_id': self.stock_item.id,
            'cantidad': '2.000',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No hay stock disponible', str(response.data))
        self.ticket.refresh_from_db()
        self.quote_line.refresh_from_db()
        self.assertEqual(self.ticket.estado, Ticket.TicketStatus.WAITING_PARTS)
        self.assertEqual(self.quote_line.supply_status, QuoteLine.SupplyStatus.OUT_OF_STOCK)
        self.assertEqual(self.ticket.stock_reservations.count(), 0)

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

    def test_deliver_reservation_marks_physical_delivery_without_consuming_stock(self):
        reservation = StockReservation.objects.create(
            stock_item=self.stock_item,
            ticket=self.ticket,
            cantidad=Decimal('1.000'),
            reservado_por=self.inventory_user,
        )
        self.stock_item.reservado = Decimal('1.000')
        self.stock_item.save(update_fields=['reservado', 'updated_at'])

        response = self.client.post(
            f'/api/products/reservations/{reservation.id}/deliver/',
            {'notas': 'Entregado al tecnico'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stock_item.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(self.stock_item.cantidad, Decimal('5.000'))
        self.assertEqual(self.stock_item.reservado, Decimal('1.000'))
        self.assertEqual(reservation.estado, StockReservation.ReservationStatus.ACTIVE)
        self.assertIsNotNone(reservation.entregado_el)
        self.assertEqual(reservation.entregado_por, self.inventory_user)

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

    def test_warehouse_can_be_restored_and_hard_deleted_when_empty(self):
        deactivate_response = self.client.delete(f'/api/products/warehouses/{self.secondary_warehouse.id}/')
        self.assertEqual(deactivate_response.status_code, status.HTTP_204_NO_CONTENT)

        self.secondary_warehouse.refresh_from_db()
        self.assertIsNotNone(self.secondary_warehouse.deleted_at)

        restore_response = self.client.post(f'/api/products/warehouses/{self.secondary_warehouse.id}/restore/')
        self.assertEqual(restore_response.status_code, status.HTTP_200_OK)

        self.secondary_warehouse.refresh_from_db()
        self.assertIsNone(self.secondary_warehouse.deleted_at)

        self.client.delete(f'/api/products/warehouses/{self.secondary_warehouse.id}/')
        hard_delete_response = self.client.post(f'/api/products/warehouses/{self.secondary_warehouse.id}/hard_delete/')
        self.assertEqual(hard_delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Warehouse.all_objects.filter(id=self.secondary_warehouse.id).exists())

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
