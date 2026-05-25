from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.finance.models import CashClosure, PaymentSchedule, Receipt
from apps.products.models import InventoryMovement, Product
from apps.suppliers.models import PurchaseOrder
from apps.users.permissions import RolePermission


class DailySummaryReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {'list': ['reports.view_financial']}

    def list(self, request):
        today = timezone.now().date()
        confirmed_receipts = Receipt.objects.filter(created_at__date=today, estado='CONFIRMED')
        pending_receipts = Receipt.objects.filter(created_at__date=today, estado='PENDING')
        closures = CashClosure.objects.filter(opened_at__date=today)

        data = {
            'date': str(today),
            'confirmed_revenue': confirmed_receipts.aggregate(total=Sum('amount'))['total'] or 0,
            'pending_revenue': pending_receipts.aggregate(total=Sum('amount'))['total'] or 0,
            'receipts_by_method': list(
                confirmed_receipts.values('metodo_pago').annotate(total=Sum('amount'), count=Count('id')).order_by('metodo_pago')
            ),
            'cash_closures': list(
                closures.values('id', 'estado', 'opened_at', 'closed_at', 'opening_amount', 'expected_amount', 'declared_amount', 'difference')
            ),
        }
        return Response(data)


class InventoryReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {'list': ['reports.view_inventory']}

    def list(self, request):
        products = Product.objects.annotate(
            stock_fisico=Coalesce(Sum('stocks__cantidad'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            stock_reservado=Coalesce(Sum('stocks__reservado'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
        ).annotate(
            stock_disponible=ExpressionWrapper(
                F('stock_fisico') - F('stock_reservado'),
                output_field=DecimalField(max_digits=12, decimal_places=3),
            ),
        )

        low_stock = products.filter(stock_disponible__lte=F('stock_minimo')).order_by('stock_disponible', 'nombre')
        movement_cutoff = timezone.now() - timezone.timedelta(days=7)

        data = {
            'summary': {
                'products_count': products.count(),
                'low_stock_count': low_stock.count(),
                'inventory_value': products.aggregate(
                    total=Sum(F('stock_fisico') * F('precio_costo'), output_field=DecimalField(max_digits=14, decimal_places=2))
                )['total'] or 0,
            },
            'low_stock_products': [
                {
                    'id': product.id,
                    'codigo': product.codigo,
                    'nombre': product.nombre,
                    'stock_fisico': str(product.stock_fisico or 0),
                    'stock_reservado': str(product.stock_reservado or 0),
                    'stock_disponible': str(product.stock_disponible or 0),
                    'stock_minimo': product.stock_minimo,
                    'suggested_quantity': str(max(product.stock_minimo - int(product.stock_disponible or 0) + 1, 1)),
                }
                for product in low_stock[:25]
            ],
            'recent_movements': list(
                InventoryMovement.objects.filter(created_at__gte=movement_cutoff)
                .values('id', 'product__codigo', 'product__nombre', 'warehouse__nombre', 'movement_type', 'quantity', 'created_at')
                .order_by('-created_at')[:50]
            ),
        }
        return Response(data)


class PurchaseReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {'list': ['reports.view_inventory']}

    def list(self, request):
        purchase_orders = PurchaseOrder.objects.select_related('supplier').all()
        data = {
            'summary': {
                'open_orders': purchase_orders.exclude(estado__in=['RECEIVED', 'CLOSED_INCOMPLETE', 'CANCELLED']).count(),
                'received_orders': purchase_orders.filter(estado='RECEIVED').count(),
                'total_committed': purchase_orders.exclude(estado='CANCELLED').aggregate(total=Sum('subtotal'))['total'] or 0,
            },
            'orders_by_status': list(
                purchase_orders.values('estado').annotate(count=Count('id'), total=Sum('subtotal')).order_by('estado')
            ),
            'top_suppliers': list(
                purchase_orders.values('supplier__id', 'supplier__nombre')
                .annotate(total=Sum('subtotal'), orders=Count('id'))
                .order_by('-total')[:10]
            ),
        }
        return Response(data)


class DelinquentCustomerReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {'list': ['reports.view_financial']}

    def list(self, request):
        today = timezone.now().date()
        overdue = PaymentSchedule.objects.filter(esta_pagado=False, due_date__lt=today).select_related('ticket__customer')

        summary = overdue.values('ticket__customer_id', 'ticket__customer__nombre', 'ticket__customer__telefono').annotate(
            overdue_installments=Count('id'),
            overdue_amount=Sum(F('amount') - F('monto_pagado'), output_field=DecimalField(max_digits=12, decimal_places=2)),
        ).order_by('-overdue_amount')

        data = {
            'summary': {
                'morosos_count': Customer.objects.filter(etiqueta='MOROSO').count(),
                'overdue_installments': overdue.count(),
                'overdue_amount': overdue.aggregate(
                    total=Sum(F('amount') - F('monto_pagado'), output_field=DecimalField(max_digits=12, decimal_places=2))
                )['total'] or 0,
            },
            'customers': list(summary[:50]),
        }
        return Response(data)
