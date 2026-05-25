from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.finance.models import CashClosure, Discount, PaymentReversal, PaymentSchedule, Receipt
from apps.products.models import Product
from apps.tickets.models import Ticket, TicketTransition
from apps.users.permissions import RolePermission

from .models import AuditLog, CompanyProfile, Notification
from .serializers import AuditLogSerializer, CompanyProfileSerializer, NotificationSerializer


class CompanyProfileViewSet(viewsets.ModelViewSet):
    queryset = CompanyProfile.objects.all()
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['config.view'],
        'retrieve': ['config.view'],
        'current': ['config.view'],
        'update': ['config.edit'],
        'partial_update': ['config.edit'],
    }

    def get_object(self):
        obj, _ = CompanyProfile.objects.get_or_create(
            defaults={
                'business_name': 'Argos ERP',
                'ruc': '12345678901',
                'phone': '064-123456',
                'email': 'contacto@argos.com',
            }
        )
        return obj

    @action(detail=False, methods=['get'])
    def current(self, request):
        serializer = self.get_serializer(self.get_object())
        return Response(serializer.data)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        is_unread = self.request.query_params.get('no_leidas')
        if is_unread == 'true':
            qs = qs.filter(is_read=False)
        return qs

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'Todas las notificaciones marcadas como leidas'})


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['audit.view'],
        'retrieve': ['audit.view'],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['module', 'action', 'user']
    search_fields = ['object_repr', 'object_id', 'model_name']
    ordering_fields = ['created_at']

    def get_queryset(self):
        return AuditLog.objects.select_related('user').all()


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from apps.suppliers.models import PurchaseOrder

        user_role = request.user.user_roles.select_related('role').first()
        role = user_role.role.nombre if user_role else 'Desconocido'

        data = {
            'role': role,
            'metrics': {},
            'charts': {},
            'recent_activity': [],
        }

        today = timezone.now().date()
        products_with_stock = Product.objects.annotate(
            stock_fisico=Coalesce(Sum('stocks__cantidad'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            stock_reservado=Coalesce(Sum('stocks__reservado'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            stock_disponible=ExpressionWrapper(
                F('stock_fisico') - F('stock_reservado'),
                output_field=DecimalField(max_digits=12, decimal_places=3),
            ),
        )
        low_stock_products_qs = products_with_stock.filter(stock_disponible__lte=F('stock_minimo')).distinct()
        active_tickets_qs = Ticket.objects.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED'])

        if role == 'Administrador' or request.user.is_superuser:
            data['metrics'] = {
                'active_tickets': active_tickets_qs.count(),
                'customers_count': Customer.objects.count(),
                'ready_tickets': Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
                'daily_revenue': Receipt.objects.filter(
                    created_at__date=today,
                    estado='CONFIRMED',
                ).aggregate(total=Sum('amount'))['total'] or 0,
                'low_stock_alerts': low_stock_products_qs.count(),
                'pending_discounts': Discount.objects.filter(estado='PENDING').count(),
                'pending_reversals': PaymentReversal.objects.filter(estado='PENDING').count(),
                'clientes_morosos': Customer.objects.filter(etiqueta='MOROSO').count(),
                'purchase_orders_open': PurchaseOrder.objects.exclude(estado__in=['RECEIVED', 'CLOSED_INCOMPLETE', 'CANCELLED']).count(),
                'storage_tickets': Ticket.objects.filter(estado='STORAGE').count(),
                'overdue_installments': PaymentSchedule.objects.filter(esta_pagado=False, due_date__lt=today).count(),
            }
            status_counts = active_tickets_qs.values('estado').annotate(count=Count('id'))
            data['charts']['tickets_by_status'] = {item['estado']: item['count'] for item in status_counts}

        elif role == 'Recepcionista':
            caja_abierta = CashClosure.objects.filter(estado='OPEN').exists()
            data['metrics'] = {
                'caja_abierta': caja_abierta,
                'ready_tickets': Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
                'pending_payments_count': Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
                'daily_revenue': Receipt.objects.filter(
                    created_at__date=today,
                    estado='CONFIRMED',
                ).aggregate(total=Sum('amount'))['total'] or 0,
            }
            revenue_by_method = Receipt.objects.filter(
                created_at__date=today,
                estado='CONFIRMED',
            ).values('metodo_pago').annotate(total=Sum('amount'))
            data['charts']['revenue_by_method'] = {item['metodo_pago']: item['total'] for item in revenue_by_method}

        elif role == 'Técnico' or role == 'TÃ©cnico':
            my_tickets = Ticket.objects.filter(assigned_to=request.user)
            data['metrics'] = {
                'my_active_tickets': my_tickets.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
                'my_urgent_tickets': my_tickets.filter(prioridad='CRITICAL').exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
                'my_completed_today': TicketTransition.objects.filter(
                    cambiado_por=request.user,
                    estado_nuevo='READY',
                    created_at__date=today,
                ).count(),
                'my_testing_tickets': my_tickets.filter(estado='IN_TESTING').count(),
                'my_waiting_parts': my_tickets.filter(estado='WAITING_PARTS').count(),
            }
            data['charts']['my_status_distribution'] = {
                item['estado']: item['count']
                for item in my_tickets.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).values('estado').annotate(count=Count('id'))
            }

        elif role == 'Almacenero':
            data['metrics'] = {
                'low_stock_alerts': low_stock_products_qs.count(),
                'total_products': Product.objects.count(),
                'inventory_value': products_with_stock.aggregate(
                    total=Sum(F('stock_fisico') * F('precio_venta'), output_field=DecimalField()),
                )['total'] or 0,
                'pending_purchase_orders': PurchaseOrder.objects.exclude(estado__in=['RECEIVED', 'CLOSED_INCOMPLETE', 'CANCELLED']).count(),
            }
            low_stock_products = products_with_stock.order_by('stock_disponible')[:5]
            data['charts']['low_stock_products'] = {p.nombre: float(p.stock_disponible or 0) for p in low_stock_products}

        return Response(data)
