from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Area, SubArea, CompanyProfile
from .serializers import AreaSerializer, SubAreaSerializer, CompanyProfileSerializer

class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer
    permission_classes = [permissions.IsAuthenticated]

class SubAreaViewSet(viewsets.ModelViewSet):
    queryset = SubArea.objects.all().select_related('area')
    serializer_class = SubAreaSerializer
    permission_classes = [permissions.IsAuthenticated]

class CompanyProfileViewSet(viewsets.ModelViewSet):
    queryset = CompanyProfile.objects.all()
    serializer_class = CompanyProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # We only have one profile, return it or create a shell if none exists
        obj, created = CompanyProfile.objects.get_or_create(
            defaults={
                'business_name': 'Argos ERP',
                'legal_name': 'Argos S.A.C.',
                'ruc': '12345678901',
                'address': 'Calle Real 123, Huancayo',
                'phone': '064-123456',
                'whatsapp': '987654321',
                'email': 'contacto@argos.com'
            }
        )
        return obj

    @action(detail=False, methods=['get'])
    def current(self, request):
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        # Placeholder for real dashboard metrics
        # We import here to avoid circular dependencies if any
        from apps.customers.models import Customer
        from apps.inventory.models import Product
        
        return Response({
            "metrics": {
                "active_tickets": 0, # To be implemented in Capa 2
                "customers_count": Customer.objects.count(),
                "products_count": Product.objects.count(),
                "low_stock_alerts": 0, # To be implemented with Inventory Logic
            },
            "recent_activity": []
        })
