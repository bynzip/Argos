from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.core.models import Notification
from apps.core.test_utils import create_role_with_permissions, create_user_with_role
from apps.customers.models import Customer
from apps.finance.models import CashClosure, Receipt
from apps.products.models import Product, StockItem, Warehouse
from apps.users.models import UserRole


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


class DashboardViewSetTests(APITestCase):
    url = '/api/core/dashboard/'

    def test_admin_receives_all_dashboard_tabs(self):
        admin = create_user_with_role('admin_dash', 'Administrador', [])
        self.client.force_authenticate(admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_dashboards'], ['admin', 'reception', 'technician', 'warehouse'])
        self.assertEqual(response.data['default_dashboard'], 'admin')

    def test_technician_receives_only_technician_dashboard(self):
        technician = create_user_with_role('tech_dash', 'Técnico', [])
        self.client.force_authenticate(technician)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_dashboards'], ['technician'])
        self.assertEqual(response.data['default_dashboard'], 'technician')

    def test_multi_role_user_receives_union_of_dashboards(self):
        user = create_user_with_role('multi_dash', 'Recepcionista', [])
        warehouse_role = create_role_with_permissions('Almacenero', [])
        UserRole.objects.get_or_create(user=user, role=warehouse_role)
        self.client.force_authenticate(user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['available_dashboards'], ['reception', 'warehouse'])

    def test_reception_cash_and_receipts_are_scoped_to_authenticated_user(self):
        receptionist = create_user_with_role('recep_dash', 'Recepcionista', [])
        other_user = create_user_with_role('other_recep_dash', 'Recepcionista', [])
        cash = CashClosure.objects.create(user=receptionist, opening_amount='50.00')
        other_cash = CashClosure.objects.create(user=other_user, opening_amount='100.00')
        Receipt.objects.create(
            folio='RC-TEST-001',
            cash_closure=cash,
            metodo_pago=Receipt.PaymentMethod.CASH,
            amount='20.00',
            estado=Receipt.ReceiptStatus.CONFIRMED,
        )
        Receipt.objects.create(
            folio='RC-TEST-002',
            cash_closure=cash,
            metodo_pago=Receipt.PaymentMethod.YAPE,
            amount='30.00',
            estado=Receipt.ReceiptStatus.PENDING,
        )
        Receipt.objects.create(
            folio='RC-TEST-003',
            cash_closure=other_cash,
            metodo_pago=Receipt.PaymentMethod.CASH,
            amount='99.00',
            estado=Receipt.ReceiptStatus.CONFIRMED,
        )
        self.client.force_authenticate(receptionist)

        response = self.client.get(self.url)

        reception = response.data['dashboards']['reception']
        self.assertEqual(reception['metrics']['cash_open'], True)
        self.assertEqual(reception['metrics']['cash_expected_amount'], 70.0)
        self.assertEqual(reception['metrics']['daily_revenue'], 20.0)
        self.assertEqual(reception['metrics']['pending_digital_payments'], 1)

    def test_warehouse_low_stock_uses_available_stock(self):
        almacenero = create_user_with_role('alm_dash', 'Almacenero', [])
        product = Product.objects.create(
            codigo='PROD-DASH-001',
            nombre='SSD Test Dashboard',
            precio_costo='10.00',
            precio_venta='20.00',
            stock_minimo=5,
        )
        warehouse = Warehouse.objects.create(nombre='Principal Dashboard', ubicacion='A1')
        StockItem.objects.create(product=product, warehouse=warehouse, cantidad='6.000', reservado='2.000')
        self.client.force_authenticate(almacenero)

        response = self.client.get(self.url)

        warehouse_dashboard = response.data['dashboards']['warehouse']
        self.assertEqual(warehouse_dashboard['metrics']['low_stock_alerts'], 1)
        self.assertEqual(warehouse_dashboard['charts']['low_stock_products'][0]['stock_disponible'], 4.0)
