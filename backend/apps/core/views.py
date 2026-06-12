from decimal import Decimal
import unicodedata

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.customers.models import Customer
from apps.finance.models import CashClosure, Discount, PaymentReversal, PaymentSchedule, Receipt
from apps.products.models import Product, StockReservation
from apps.quotes.models import Quote
from apps.tickets.models import (
    Ticket,
    TicketAccessory,
    TicketChecklistEvidence,
    TicketChecklistItem,
    TicketEvidence,
    TicketSubareaMovement,
    TicketTransition,
)
from apps.users.models import User
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

    def get_permissions(self):
        if self.action == 'current':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_object(self):
        obj = CompanyProfile.objects.order_by('-updated_at', '-id').first()
        if obj is None:
            obj = CompanyProfile.objects.create(
                business_name='Argos ERP',
                ruc='12345678901',
                phone='064-123456',
                email='contacto@argos.com',
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

    dashboard_order = ['admin', 'reception', 'technician', 'warehouse']
    role_dashboard_map = {
        'administrador': dashboard_order,
        'recepcionista': ['reception'],
        'tecnico': ['technician'],
        'tã©cnico': ['technician'],
        'almacenero': ['warehouse'],
    }
    closed_ticket_statuses = [
        Ticket.TicketStatus.DELIVERED,
        Ticket.TicketStatus.CLOSED,
        Ticket.TicketStatus.REJECTED,
    ]

    def _money(self, value):
        return float(value or Decimal('0.00'))

    def _quantity(self, value):
        return float(value or Decimal('0.000'))

    def _normalize_role_name(self, role_name):
        normalized = unicodedata.normalize('NFKD', role_name or '')
        normalized = normalized.encode('ascii', 'ignore').decode('ascii')
        return normalized.strip().lower()

    def _resolve_dashboards(self, user):
        if user.is_superuser:
            return self.dashboard_order[:]

        dashboards = set()
        role_names = user.user_roles.select_related('role').values_list('role__nombre', flat=True)
        for role_name in role_names:
            dashboards.update(self.role_dashboard_map.get(self._normalize_role_name(role_name), []))
            dashboards.update(self.role_dashboard_map.get((role_name or '').strip().lower(), []))

        return [key for key in self.dashboard_order if key in dashboards]

    def _tickets_with_balance(self, qs):
        return qs.annotate(
            confirmed_paid=Coalesce(
                Sum('receipts__amount', filter=Q(receipts__estado=Receipt.ReceiptStatus.CONFIRMED)),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            pending_balance=ExpressionWrapper(
                F('total') - F('confirmed_paid'),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )

    def _serialize_ticket(self, ticket):
        device = ''
        if ticket.device:
            device = f'{ticket.device.marca} {ticket.device.modelo}'.strip()
        pending_balance = getattr(ticket, 'pending_balance', None)
        return {
            'id': str(ticket.id),
            'folio': ticket.folio,
            'customer': ticket.customer.nombre if ticket.customer_id else '',
            'device': device,
            'estado': ticket.estado,
            'prioridad': ticket.prioridad,
            'total': self._money(ticket.total),
            'saldo_pendiente': self._money(pending_balance),
            'created_at': ticket.created_at,
        }

    def _serialize_low_stock_product(self, product):
        return {
            'id': product.id,
            'codigo': product.codigo,
            'nombre': product.nombre,
            'stock_minimo': self._quantity(product.stock_minimo),
            'stock_fisico': self._quantity(product.stock_fisico),
            'stock_reservado': self._quantity(product.stock_reservado),
            'stock_disponible': self._quantity(product.stock_disponible),
        }

    def _serialize_reservation(self, reservation):
        return {
            'id': reservation.id,
            'product': reservation.stock_item.product.nombre,
            'ticket_id': str(reservation.ticket_id),
            'ticket_folio': reservation.ticket.folio,
            'technician': reservation.ticket.assigned_to.nombre if reservation.ticket.assigned_to_id else '',
            'cantidad': self._quantity(reservation.cantidad),
            'entregado': bool(reservation.entregado_el),
            'created_at': reservation.created_at,
        }

    def _audit_related_url(self, log):
        from apps.suppliers.models import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatusHistory
        from apps.quotes.models import Quote, QuoteApproval, QuoteAttachment, QuoteLine

        related_data = {}
        for source in (log.extra, log.after_data, log.before_data):
            if isinstance(source, dict):
                related_data.update(source)

        ticket_id = related_data.get('ticket_id') or related_data.get('ticket_padre_id')
        if ticket_id:
            return f'/tickets/{ticket_id}'

        if log.model_name == 'Ticket' and log.object_id:
            return f'/tickets/{log.object_id}'

        if log.model_name == 'Quote' and log.object_id:
            return f'/quotes/{log.object_id}'

        if log.model_name == 'PurchaseOrder' and log.object_id:
            return f'/suppliers/orders/{log.object_id}'

        ticket_models = {
            'TicketAccessory': TicketAccessory,
            'TicketEvidence': TicketEvidence,
            'TicketTransition': TicketTransition,
            'TicketChecklistItem': TicketChecklistItem,
            'TicketSubareaMovement': TicketSubareaMovement,
        }
        model = ticket_models.get(log.model_name)
        if model and log.object_id:
            obj = model.objects.filter(pk=log.object_id).only('ticket_id').first()
            if obj and getattr(obj, 'ticket_id', None):
                return f'/tickets/{obj.ticket_id}'

        if log.model_name == 'TicketChecklistEvidence' and log.object_id:
            evidence = TicketChecklistEvidence.objects.select_related('checklist_item').filter(pk=log.object_id).first()
            if evidence and evidence.checklist_item_id:
                return f'/tickets/{evidence.checklist_item.ticket_id}'

        quote_models = {
            'QuoteLine': QuoteLine,
            'QuoteApproval': QuoteApproval,
            'QuoteAttachment': QuoteAttachment,
        }
        quote_model = quote_models.get(log.model_name)
        if quote_model and log.object_id:
            obj = quote_model.objects.filter(pk=log.object_id).only('quote_id').first()
            if obj and getattr(obj, 'quote_id', None):
                return f'/quotes/{obj.quote_id}'

        purchase_order_models = {
            'PurchaseOrderItem': PurchaseOrderItem,
            'PurchaseOrderStatusHistory': PurchaseOrderStatusHistory,
        }
        purchase_order_model = purchase_order_models.get(log.model_name)
        if purchase_order_model and log.object_id:
            obj = purchase_order_model.objects.filter(pk=log.object_id).only('purchase_order_id').first()
            if obj and getattr(obj, 'purchase_order_id', None):
                return f'/suppliers/orders/{obj.purchase_order_id}'

        return ''

    def _audit_display_label(self, log):
        from apps.suppliers.models import PurchaseOrderItem, PurchaseOrderStatusHistory
        from apps.quotes.models import QuoteApproval, QuoteAttachment, QuoteLine

        if log.model_name == 'TicketChecklistItem' and log.object_id:
            item = TicketChecklistItem.objects.filter(pk=log.object_id).only('nombre').first()
            if item:
                return item.nombre

        if log.model_name == 'TicketChecklistEvidence' and log.object_id:
            evidence = TicketChecklistEvidence.objects.select_related('checklist_item').filter(pk=log.object_id).first()
            if evidence and evidence.checklist_item_id:
                return evidence.checklist_item.nombre

        if log.model_name == 'TicketTransition' and log.object_id:
            transition = TicketTransition.objects.select_related('ticket').filter(pk=log.object_id).first()
            if transition and transition.ticket_id:
                return transition.ticket.folio

        if log.model_name == 'TicketSubareaMovement' and log.object_id:
            movement = TicketSubareaMovement.objects.select_related('ticket').filter(pk=log.object_id).first()
            if movement and movement.ticket_id:
                return movement.ticket.folio

        if log.model_name == 'PurchaseOrderItem' and log.object_id:
            item = PurchaseOrderItem.objects.select_related('purchase_order').filter(pk=log.object_id).first()
            if item and item.purchase_order_id:
                return item.purchase_order.folio

        if log.model_name == 'PurchaseOrderStatusHistory' and log.object_id:
            history = PurchaseOrderStatusHistory.objects.select_related('purchase_order').filter(pk=log.object_id).first()
            if history and history.purchase_order_id:
                return history.purchase_order.folio

        quote_models = {
            'QuoteLine': QuoteLine,
            'QuoteApproval': QuoteApproval,
            'QuoteAttachment': QuoteAttachment,
        }
        quote_model = quote_models.get(log.model_name)
        if quote_model and log.object_id:
            obj = quote_model.objects.select_related('quote').filter(pk=log.object_id).first()
            if obj and getattr(obj, 'quote_id', None):
                return obj.quote.folio

        return log.object_repr or log.object_id or log.module

    def _serialize_audit_log(self, log):
        before_data = log.before_data if isinstance(log.before_data, dict) else {}
        after_data = log.after_data if isinstance(log.after_data, dict) else {}
        changed_fields = [
            key for key in sorted(set(before_data.keys()) | set(after_data.keys()))
            if before_data.get(key) != after_data.get(key)
        ][:5]

        return {
            'id': log.id,
            'action': log.action,
            'action_label': log.get_action_display(),
            'module': log.module,
            'model_name': log.model_name,
            'object_id': log.object_id,
            'object_repr': log.object_repr,
            'display_label': self._audit_display_label(log),
            'user': log.user.nombre if log.user_id else 'Sistema',
            'changed_fields': changed_fields,
            'extra': log.extra or {},
            'related_url': self._audit_related_url(log),
            'created_at': log.created_at,
        }

    def _build_revenue_trend(self, today):
        start_date = today - timezone.timedelta(days=6)
        totals = {
            item['day']: item['total'] or Decimal('0.00')
            for item in Receipt.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=today,
                estado=Receipt.ReceiptStatus.CONFIRMED,
            )
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(total=Sum('amount'))
        }
        return [
            {
                'date': (start_date + timezone.timedelta(days=offset)).isoformat(),
                'total': self._money(totals.get(start_date + timezone.timedelta(days=offset))),
            }
            for offset in range(7)
        ]

    def _payment_method_totals(self, today, user=None):
        qs = Receipt.objects.filter(created_at__date=today, estado=Receipt.ReceiptStatus.CONFIRMED)
        if user is not None:
            qs = qs.filter(cash_closure__user=user)
        return {
            item['metodo_pago']: self._money(item['total'])
            for item in qs.values('metodo_pago').annotate(total=Sum('amount'))
        }

    def _ticket_status_counts(self, qs):
        return {
            item['estado']: item['count']
            for item in qs.values('estado').annotate(count=Count('id')).order_by('estado')
        }

    def _build_admin_dashboard(self, context):
        PurchaseOrder = context['PurchaseOrder']
        today = context['today']
        active_tickets_qs = context['active_tickets_qs']
        low_stock_products_qs = context['low_stock_products_qs']
        ready_with_balance = self._tickets_with_balance(
            Ticket.objects.filter(estado__in=[Ticket.TicketStatus.READY, Ticket.TicketStatus.STORAGE])
        )
        open_purchase_orders = PurchaseOrder.objects.exclude(
            estado__in=[PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CLOSED_INCOMPLETE, PurchaseOrder.Status.CANCELLED]
        )
        cash_differences = CashClosure.objects.filter(estado=CashClosure.Status.CLOSED, closed_at__date=today).exclude(difference=0)
        pending_digital = Receipt.objects.filter(estado=Receipt.ReceiptStatus.PENDING).exclude(metodo_pago=Receipt.PaymentMethod.CASH)
        technicians = User.objects.filter(user_roles__role__nombre__in=['Técnico', 'TÃ©cnico']).distinct()
        technician_load = []
        for technician in technicians:
            assigned = Ticket.objects.filter(assigned_to=technician)
            technician_load.append({
                'id': technician.id,
                'nombre': technician.nombre,
                'active_tickets': assigned.exclude(estado__in=self.closed_ticket_statuses).count(),
                'ready_today': TicketTransition.objects.filter(cambiado_por=technician, estado_nuevo=Ticket.TicketStatus.READY, created_at__date=today).count(),
                'urgent_tickets': assigned.filter(prioridad=Ticket.TicketPriority.CRITICAL).exclude(estado__in=self.closed_ticket_statuses).count(),
            })

        return {
            'metrics': {
                'active_tickets': active_tickets_qs.count(),
                'daily_revenue': self._money(Receipt.objects.filter(created_at__date=today, estado=Receipt.ReceiptStatus.CONFIRMED).aggregate(total=Sum('amount'))['total']),
                'customers_count': Customer.objects.count(),
                'ready_tickets': ready_with_balance.count(),
                'storage_tickets': Ticket.objects.filter(estado=Ticket.TicketStatus.STORAGE).count(),
                'low_stock_alerts': low_stock_products_qs.count(),
                'pending_discounts': Discount.objects.filter(estado=Discount.DiscountStatus.PENDING).count(),
                'pending_reversals': PaymentReversal.objects.filter(estado=PaymentReversal.ReversalStatus.PENDING).count(),
                'pending_digital_payments': pending_digital.count(),
                'overdue_installments': PaymentSchedule.objects.filter(esta_pagado=False, due_date__lt=today).count(),
                'clientes_morosos': Customer.objects.filter(etiqueta='MOROSO').count(),
                'purchase_orders_open': open_purchase_orders.count(),
                'cash_difference_count': cash_differences.count(),
                'cash_difference_total': self._money(cash_differences.aggregate(total=Sum('difference'))['total']),
            },
            'charts': {
                'ticket_flow': self._ticket_status_counts(active_tickets_qs),
                'revenue_trend': self._build_revenue_trend(today),
                'payment_methods_today': self._payment_method_totals(today),
            },
            'actions': {
                'pending_digital_payments': [
                    {
                        'id': receipt.id,
                        'folio': receipt.folio,
                        'method': receipt.metodo_pago,
                        'amount': self._money(receipt.amount),
                        'ticket_id': str(receipt.ticket_id) if receipt.ticket_id else '',
                        'ticket_folio': receipt.ticket.folio if receipt.ticket_id else '',
                        'created_at': receipt.created_at,
                    }
                    for receipt in pending_digital.select_related('ticket').order_by('-created_at')[:4]
                ],
                'pending_discounts': [
                    {
                        'id': discount.id,
                        'ticket_folio': discount.ticket.folio if discount.ticket_id else '',
                        'amount': self._money(discount.respuesta),
                        'type': discount.tipo_descuento,
                        'requested_by': discount.solicitado_por.nombre if discount.solicitado_por_id else '',
                        'created_at': discount.created_at,
                    }
                    for discount in Discount.objects.select_related('ticket', 'solicitado_por').filter(estado=Discount.DiscountStatus.PENDING).order_by('-created_at')[:4]
                ],
                'pending_reversals': [
                    {
                        'id': reversal.id,
                        'receipt_folio': reversal.receipt.folio,
                        'amount': self._money(reversal.receipt.amount),
                        'requested_by': reversal.solicitado_por.nombre if reversal.solicitado_por_id else '',
                        'created_at': reversal.created_at,
                    }
                    for reversal in PaymentReversal.objects.select_related('receipt', 'solicitado_por').filter(estado=PaymentReversal.ReversalStatus.PENDING).order_by('-created_at')[:4]
                ],
                'overdue_installments': [
                    {
                        'id': schedule.id,
                        'ticket_folio': schedule.ticket.folio,
                        'customer': schedule.ticket.customer.nombre,
                        'amount': self._money(schedule.amount - schedule.monto_pagado),
                        'due_date': schedule.due_date,
                    }
                    for schedule in PaymentSchedule.objects.select_related('ticket__customer').filter(esta_pagado=False, due_date__lt=today).order_by('due_date')[:5]
                ],
                'low_stock': [self._serialize_low_stock_product(product) for product in low_stock_products_qs[:5]],
                'audit_logs': [
                    self._serialize_audit_log(log)
                    for log in AuditLog.objects.select_related('user').order_by('-created_at')[:6]
                ],
            },
        }

    def _build_reception_dashboard(self, context):
        today = context['today']
        user = context['user']
        open_cash = CashClosure.objects.filter(user=user, estado=CashClosure.Status.OPEN).first()
        confirmed_receipts = Receipt.objects.filter(cash_closure__user=user, created_at__date=today, estado=Receipt.ReceiptStatus.CONFIRMED)
        pending_digital = Receipt.objects.filter(cash_closure__user=user, estado=Receipt.ReceiptStatus.PENDING).exclude(metodo_pago=Receipt.PaymentMethod.CASH)
        ready_with_balance = self._tickets_with_balance(
            Ticket.objects.select_related('customer', 'device').filter(estado__in=[Ticket.TicketStatus.READY, Ticket.TicketStatus.STORAGE])
        )

        return {
            'metrics': {
                'cash_open': bool(open_cash),
                'cash_opening_amount': self._money(open_cash.opening_amount if open_cash else None),
                'cash_expected_amount': self._money((open_cash.opening_amount if open_cash else Decimal('0.00')) + (confirmed_receipts.filter(metodo_pago=Receipt.PaymentMethod.CASH).aggregate(total=Sum('amount'))['total'] or Decimal('0.00'))),
                'daily_revenue': self._money(confirmed_receipts.aggregate(total=Sum('amount'))['total']),
                'ready_tickets': ready_with_balance.count(),
                'ready_with_pending_balance': ready_with_balance.filter(pending_balance__gt=0).count(),
                'pending_digital_payments': pending_digital.count(),
                'quotes_sent_today': Quote.objects.filter(created_at__date=today, estado=Quote.QuoteStatus.SENT).count(),
                'quotes_pending': Quote.objects.filter(estado__in=[Quote.QuoteStatus.DRAFT, Quote.QuoteStatus.SENT]).count(),
            },
            'charts': {
                'payment_methods_today': self._payment_method_totals(today, user=user),
            },
            'actions': {
                'ready_to_deliver': [self._serialize_ticket(ticket) for ticket in ready_with_balance.filter(pending_balance__lte=0).order_by('-updated_at')[:5]],
                'pending_collection': [self._serialize_ticket(ticket) for ticket in ready_with_balance.filter(pending_balance__gt=0).order_by('-updated_at')[:5]],
                'pending_digital_payments': [
                    {
                        'id': receipt.id,
                        'folio': receipt.folio,
                        'method': receipt.metodo_pago,
                        'amount': self._money(receipt.amount),
                        'ticket_id': str(receipt.ticket_id) if receipt.ticket_id else '',
                        'ticket_folio': receipt.ticket.folio if receipt.ticket_id else '',
                        'created_at': receipt.created_at,
                    }
                    for receipt in pending_digital.select_related('ticket').order_by('-created_at')[:5]
                ],
                'quotes_to_send': [
                    {
                        'id': quote.id,
                        'folio': quote.folio,
                        'customer': quote.customer.nombre,
                        'total': self._money(quote.total),
                        'created_at': quote.created_at,
                    }
                    for quote in Quote.objects.select_related('customer').filter(estado=Quote.QuoteStatus.DRAFT).order_by('-created_at')[:5]
                ],
            },
        }

    def _build_technician_dashboard(self, context):
        today = context['today']
        active_tickets = Ticket.objects.select_related('customer', 'device').exclude(estado__in=self.closed_ticket_statuses)
        completed_today = TicketTransition.objects.filter(estado_nuevo=Ticket.TicketStatus.READY, created_at__date=today).count()
        active_count = active_tickets.count()
        progress_rate = round((completed_today / max(active_count + completed_today, 1)) * 100)
        technical_states = [
            Ticket.TicketStatus.DIAGNOSTIC,
            Ticket.TicketStatus.QUOTED,
            Ticket.TicketStatus.IN_REPAIR,
            Ticket.TicketStatus.IN_TESTING,
            Ticket.TicketStatus.WAITING_PARTS,
        ]

        return {
            'metrics': {
                'active_tickets': active_count,
                'urgent_tickets': active_tickets.filter(prioridad=Ticket.TicketPriority.CRITICAL).count(),
                'completed_today': completed_today,
                'waiting_parts': active_tickets.filter(estado=Ticket.TicketStatus.WAITING_PARTS).count(),
                'testing_tickets': active_tickets.filter(estado=Ticket.TicketStatus.IN_TESTING).count(),
                'my_active_tickets': active_count,
                'my_urgent_tickets': active_tickets.filter(prioridad=Ticket.TicketPriority.CRITICAL).count(),
                'my_completed_today': completed_today,
                'my_waiting_parts': active_tickets.filter(estado=Ticket.TicketStatus.WAITING_PARTS).count(),
                'my_testing_tickets': active_tickets.filter(estado=Ticket.TicketStatus.IN_TESTING).count(),
                'progress_rate': progress_rate,
            },
            'charts': {
                'status_distribution': {state: active_tickets.filter(estado=state).count() for state in technical_states},
            },
            'actions': {
                'diagnosis_queue': [self._serialize_ticket(ticket) for ticket in active_tickets.filter(estado=Ticket.TicketStatus.DIAGNOSTIC).order_by('created_at')[:4]],
                'repair_queue': [self._serialize_ticket(ticket) for ticket in active_tickets.filter(estado=Ticket.TicketStatus.IN_REPAIR).order_by('created_at')[:4]],
                'testing_queue': [self._serialize_ticket(ticket) for ticket in active_tickets.filter(estado=Ticket.TicketStatus.IN_TESTING).order_by('created_at')[:4]],
                'waiting_parts': [self._serialize_ticket(ticket) for ticket in active_tickets.filter(estado=Ticket.TicketStatus.WAITING_PARTS).order_by('created_at')[:4]],
            },
        }

    def _build_warehouse_dashboard(self, context):
        PurchaseOrder = context['PurchaseOrder']
        products_with_stock = context['products_with_stock']
        low_stock_products_qs = context['low_stock_products_qs']
        active_reservations = StockReservation.objects.select_related('stock_item__product', 'ticket__assigned_to').filter(estado=StockReservation.ReservationStatus.ACTIVE)
        open_purchase_orders = PurchaseOrder.objects.select_related('supplier').exclude(
            estado__in=[PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CLOSED_INCOMPLETE, PurchaseOrder.Status.CANCELLED]
        )

        return {
            'metrics': {
                'low_stock_alerts': low_stock_products_qs.count(),
                'active_reservations': active_reservations.count(),
                'pending_delivery_reservations': active_reservations.filter(entregado_el__isnull=True).count(),
                'total_products': Product.objects.count(),
                'purchase_orders_open': open_purchase_orders.count(),
                'purchase_orders_partially_received': PurchaseOrder.objects.filter(estado=PurchaseOrder.Status.PARTIALLY_RECEIVED).count(),
                'inventory_value': self._money(products_with_stock.aggregate(total=Sum(F('stock_fisico') * F('precio_venta'), output_field=DecimalField(max_digits=14, decimal_places=2)))['total']),
            },
            'charts': {
                'low_stock_products': [self._serialize_low_stock_product(product) for product in low_stock_products_qs[:8]],
            },
            'actions': {
                'reservations_to_deliver': [self._serialize_reservation(reservation) for reservation in active_reservations.filter(entregado_el__isnull=True).order_by('created_at')[:5]],
                'purchase_orders': [
                    {
                        'id': purchase_order.id,
                        'folio': purchase_order.folio,
                        'supplier': purchase_order.supplier.nombre,
                        'estado': purchase_order.estado,
                        'subtotal': self._money(purchase_order.subtotal),
                        'created_at': purchase_order.created_at,
                    }
                    for purchase_order in open_purchase_orders.order_by('-created_at')[:5]
                ],
            },
        }

    def list(self, request):
        from apps.suppliers.models import PurchaseOrder

        today = timezone.now().date()
        products_with_stock = Product.objects.annotate(
            stock_fisico=Coalesce(Sum('stocks__cantidad'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            stock_reservado=Coalesce(Sum('stocks__reservado'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            stock_disponible=ExpressionWrapper(
                F('stock_fisico') - F('stock_reservado'),
                output_field=DecimalField(max_digits=12, decimal_places=3),
            ),
        )
        low_stock_products_qs = products_with_stock.filter(stock_disponible__lte=F('stock_minimo')).distinct().order_by('stock_disponible', 'nombre')
        active_tickets_qs = Ticket.objects.exclude(estado__in=self.closed_ticket_statuses)
        available_dashboards = self._resolve_dashboards(request.user)

        context = {
            'PurchaseOrder': PurchaseOrder,
            'today': today,
            'user': request.user,
            'products_with_stock': products_with_stock,
            'low_stock_products_qs': low_stock_products_qs,
            'active_tickets_qs': active_tickets_qs,
        }
        builders = {
            'admin': self._build_admin_dashboard,
            'reception': self._build_reception_dashboard,
            'technician': self._build_technician_dashboard,
            'warehouse': self._build_warehouse_dashboard,
        }

        return Response({
            'available_dashboards': available_dashboards,
            'default_dashboard': available_dashboards[0] if available_dashboards else None,
            'dashboards': {key: builders[key](context) for key in available_dashboards},
            'generated_at': timezone.now(),
        })
