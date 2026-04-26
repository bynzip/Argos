from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
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
        from apps.tickets.models import Ticket
        
        role = request.user.role_users.first().role.nombre if request.user.role_users.exists() else 'Desconocido'
        
        # Base response
        data = {
            "role": role,
            "metrics": {},
            "recent_activity": []
        }

        # Add specific metrics based on role
        if role == 'Administrador' or request.user.is_superuser:
            data['metrics'] = {
                "active_tickets": Ticket.objects.exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
                "customers_count": Customer.objects.count(),
                "products_count": Product.objects.count(),
            }
        elif role == 'Recepcionista':
            data['metrics'] = {
                "ready_tickets": Ticket.objects.filter(estado__in=['READY', 'STORAGE']).count(),
            }
        elif role == 'Técnico':
            data['metrics'] = {
                "my_active_tickets": Ticket.objects.filter(assigned_to=request.user).exclude(estado__in=['DELIVERED', 'CLOSED', 'REJECTED']).count(),
            }
        elif role == 'Almacenero':
            # Find products below minimum stock
            low_stock = Product.objects.filter(stocks__cantidad__lte=models.F('stock_minimo')).distinct().count()
            data['metrics'] = {
                "low_stock_alerts": low_stock,
            }

        return Response(data)
