from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role
from apps.products.models import Product, Warehouse
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
