from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role
from apps.products.models import InventoryMovement, Product, StockItem, Warehouse
from .models import Supplier


class SupplierPurchaseOrderTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_role(
            'alm_sup',
            'Almacenero',
            ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.manage_orders', 'inventory.manage_movements'],
        )
        self.client.force_authenticate(self.user)
        self.supplier = Supplier.objects.create(nombre='Proveedor Test', ruc='20111111111')
        self.warehouse = Warehouse.objects.create(nombre='Compras', ubicacion='A1')
        self.product = Product.objects.create(
            codigo='PROD-COMPRA-1',
            nombre='Memoria RAM',
            precio_costo=Decimal('30.00'),
            precio_venta=Decimal('55.00'),
            stock_minimo=2,
        )

    def test_create_send_and_partial_receive_purchase_order(self):
        response = self.client.post('/api/suppliers/purchase-orders/', {
            'supplier': self.supplier.id,
            'destination_warehouse': self.warehouse.id,
            'items': [
                {'product': self.product.id, 'cantidad_pedida': '5.000', 'precio_unitario': '25.00'}
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.data['id']

        send_response = self.client.post(f'/api/suppliers/purchase-orders/{order_id}/send_order/', {}, format='json')
        self.assertEqual(send_response.status_code, status.HTTP_200_OK)

        receive_response = self.client.post(
            f'/api/suppliers/purchase-orders/{order_id}/receive_order/',
            {'items': [{'id': send_response.data["items"][0]["id"], 'cantidad_recibida': '2.000'}]},
            format='json'
        )
        self.assertEqual(receive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receive_response.data['estado'], 'PARTIALLY_RECEIVED')

    def test_update_draft_purchase_order_replaces_items_and_recalculates_subtotal(self):
        second_product = Product.objects.create(
            codigo='PROD-COMPRA-2',
            nombre='Disco SSD',
            precio_costo=Decimal('80.00'),
            precio_venta=Decimal('120.00'),
            stock_minimo=1,
        )
        create_response = self.client.post('/api/suppliers/purchase-orders/', {
            'supplier': self.supplier.id,
            'destination_warehouse': self.warehouse.id,
            'items': [
                {'product': self.product.id, 'cantidad_pedida': '2.000', 'precio_unitario': '25.00'}
            ],
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        order_id = create_response.data['id']
        original_item_id = create_response.data['items'][0]['id']

        update_response = self.client.patch(f'/api/suppliers/purchase-orders/{order_id}/', {
            'supplier': self.supplier.id,
            'destination_warehouse': self.warehouse.id,
            'notes': 'Ajuste de pedido',
            'items': [
                {
                    'id': original_item_id,
                    'product': self.product.id,
                    'cantidad_pedida': '4.000',
                    'precio_unitario': '24.00',
                },
                {
                    'product': second_product.id,
                    'cantidad_pedida': '1.000',
                    'precio_unitario': '75.00',
                },
            ],
        }, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['notes'], 'Ajuste de pedido')
        self.assertEqual(len(update_response.data['items']), 2)
        self.assertEqual(update_response.data['subtotal'], '171.00')

    def test_receive_serializable_product_requires_exact_serial_numbers(self):
        serializable_product = Product.objects.create(
            codigo='PROD-COMPRA-3',
            nombre='Disco NVMe',
            precio_costo=Decimal('90.00'),
            precio_venta=Decimal('145.00'),
            stock_minimo=1,
            is_serializable=True,
        )
        create_response = self.client.post('/api/suppliers/purchase-orders/', {
            'supplier': self.supplier.id,
            'destination_warehouse': self.warehouse.id,
            'items': [
                {'product': serializable_product.id, 'cantidad_pedida': '2.000', 'precio_unitario': '88.00'}
            ],
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        order_id = create_response.data['id']
        item_id = create_response.data['items'][0]['id']

        self.client.post(f'/api/suppliers/purchase-orders/{order_id}/send_order/', {}, format='json')

        missing_serials = self.client.post(
            f'/api/suppliers/purchase-orders/{order_id}/receive_order/',
            {'items': [{'id': item_id, 'cantidad_recibida': '2.000'}]},
            format='json',
        )
        self.assertEqual(missing_serials.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('serial_numbers', missing_serials.data)

        bad_count = self.client.post(
            f'/api/suppliers/purchase-orders/{order_id}/receive_order/',
            {
                'items': [{
                    'id': item_id,
                    'cantidad_recibida': '2.000',
                    'serial_numbers': ['SN-001'],
                }]
            },
            format='json',
        )
        self.assertEqual(bad_count.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('serial_numbers', bad_count.data)

        success = self.client.post(
            f'/api/suppliers/purchase-orders/{order_id}/receive_order/',
            {
                'items': [{
                    'id': item_id,
                    'cantidad_recibida': '2.000',
                    'serial_numbers': ['SN-001', 'SN-002'],
                }]
            },
            format='json',
        )
        self.assertEqual(success.status_code, status.HTTP_200_OK)
        self.assertEqual(success.data['estado'], 'RECEIVED')
        self.assertEqual(success.data['items'][0]['serial_numbers'], ['SN-001', 'SN-002'])

        stock_item = StockItem.objects.get(product=serializable_product, warehouse=self.warehouse)
        self.assertEqual(stock_item.cantidad, Decimal('2.000'))
        self.assertTrue(
            InventoryMovement.objects.filter(
                product=serializable_product,
                warehouse=self.warehouse,
                movement_type=InventoryMovement.MovementType.ENTRY,
                serial_numbers=['SN-001', 'SN-002'],
            ).exists()
        )

    def test_partial_receive_can_be_closed_as_incomplete(self):
        create_response = self.client.post('/api/suppliers/purchase-orders/', {
            'supplier': self.supplier.id,
            'destination_warehouse': self.warehouse.id,
            'items': [
                {'product': self.product.id, 'cantidad_pedida': '5.000', 'precio_unitario': '25.00'}
            ],
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        order_id = create_response.data['id']
        item_id = create_response.data['items'][0]['id']

        self.client.post(f'/api/suppliers/purchase-orders/{order_id}/send_order/', {}, format='json')

        receive_response = self.client.post(
            f'/api/suppliers/purchase-orders/{order_id}/receive_order/',
            {
                'close_incomplete': True,
                'items': [{'id': item_id, 'cantidad_recibida': '3.000'}],
            },
            format='json',
        )

        self.assertEqual(receive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(receive_response.data['estado'], 'CLOSED_INCOMPLETE')
