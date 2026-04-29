from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
from .models import CompanyProfile, Notification
from .serializers import CompanyProfileSerializer, NotificationSerializer

class CompanyProfileViewSet(viewsets.ModelViewSet):
    queryset = CompanyProfile.objects.all()
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj, created = CompanyProfile.objects.get_or_create(
            defaults={
                'business_name': 'Argos ERP',
                'ruc': '12345678901',
                'phone': '064-123456',
                'email': 'contacto@argos.com'
            }
        )
        return obj

    @action(detail=False, methods=['get'])
    def current(self, request):
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        is_unread = self.request.query_params.get('no_leidas', None)
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
        return Response({'detail': 'Todas las notificaciones marcadas como leídas'})

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from apps.customers.models import Customer
        from apps.products.models import Product
        from apps.tickets.models import Ticket, TicketTransition
        from apps.finance.models import Receipt, Caja
        
        user_role = request.user.user_roles.select_related('role').first()
        role = user_role.role.nombre if user_role else 'Desconocido'
        
        # Base response
        data = {
            "role": role,
            "metrics": {},
            "charts": {},
            "recent_activity": []
        }

        today = timezone.now().date()
        
        # Commmon metrics
        active_tickets_qs = Ticket.objects.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED'])
        
        if role == 'Administrador' or request.user.is_superuser:
            data['metrics'] = {
                "active_tickets": active_tickets_qs.count(),
                "customers_count": Customer.objects.count(),
                "ready_tickets": Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
                "daily_revenue": Receipt.objects.filter(
                    created_at__date=today, 
                    estado='CONFIRMED'
                ).aggregate(total=models.Sum('amount'))['total'] or 0,
                "low_stock_alerts": Product.objects.filter(stocks__cantidad__lte=models.F('stock_minimo')).distinct().count(),
            }
            
            # Chart: Tickets by Status
            status_counts = active_tickets_qs.values('estado').annotate(count=models.Count('id'))
            data['charts']['tickets_by_status'] = {item['estado']: item['count'] for item in status_counts}
            
        elif role == 'Recepcionista':
            caja_abierta = Caja.objects.filter(estado='OPEN').exists()
            data['metrics'] = {
                "caja_abierta": caja_abierta,
                "ready_tickets": Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
                "pending_payments_count": Ticket.objects.filter(estado='READY').count(), # Simplified
                "daily_revenue": Receipt.objects.filter(
                    created_at__date=today, 
                    estado='CONFIRMED'
                ).aggregate(total=models.Sum('amount'))['total'] or 0,
            }
            
            # Chart: Revenue by Method Today
            revenue_by_method = Receipt.objects.filter(
                created_at__date=today, 
                estado='CONFIRMED'
            ).values('method').annotate(total=models.Sum('amount'))
            data['charts']['revenue_by_method'] = {item['method']: item['total'] for item in revenue_by_method}

        elif role == 'Técnico':
            my_tickets = Ticket.objects.filter(assigned_to=request.user)
            data['metrics'] = {
                "my_active_tickets": my_tickets.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
                "my_urgent_tickets": my_tickets.filter(prioridad='CRITICAL').exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
                "my_completed_today": TicketTransition.objects.filter(
                    cambiado_por=request.user,
                    estado_nuevo='READY',
                    created_at__date=today
                ).count(),
                "my_testing_tickets": my_tickets.filter(estado='IN_TESTING').count(),
            }
            
            # Chart: My productivity (completed in last 7 days)
            # This is a bit more complex, let's just give a summary for now
            data['charts']['my_status_distribution'] = {
                item['estado']: item['count'] 
                for item in my_tickets.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).values('estado').annotate(count=models.Count('id'))
            }

        elif role == 'Almacenero':
            data['metrics'] = {
                "low_stock_alerts": Product.objects.filter(stocks__cantidad__lte=models.F('stock_minimo')).distinct().count(),
                "total_products": Product.objects.count(),
            }

        return Response(data)
