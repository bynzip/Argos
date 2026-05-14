from django.core.management import call_command
from django.test import TestCase

from apps.core.models import Notification
from apps.core.test_utils import create_user_with_role
from apps.products.models import Product, StockItem, Warehouse


class LowStockCommandTests(TestCase):
    def setUp(self):
        self.admin = create_user_with_role('admin_cmd', 'Administrador', [])
        self.almacenero = create_user_with_role('alm_cmd', 'Almacenero', [])
        self.product = Product.objects.create(
            codigo='PROD-0001',
            nombre='Memoria RAM',
            precio_costo='10.00',
            precio_venta='20.00',
            stock_minimo=5,
        )
        self.warehouse = Warehouse.objects.create(nombre='Principal', ubicacion='A1')
        StockItem.objects.create(product=self.product, warehouse=self.warehouse, cantidad=2, reservado=1)

    def test_low_stock_command_creates_notifications_without_crashing(self):
        call_command('verificar_stock_bajo')
        self.assertEqual(Notification.objects.count(), 2)
