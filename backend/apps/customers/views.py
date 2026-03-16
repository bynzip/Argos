from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Customer, Device
from .serializers import CustomerSerializer, DeviceSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().prefetch_related('devices')
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_type', 'label', 'is_active']
    search_fields = ['name', 'identifier', 'phone', 'email']
    ordering_fields = ['created_at', 'name']

class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all().select_related('customer')
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['device_type', 'brand', 'customer', 'is_active']
    search_fields = ['model', 'serial_number', 'customer__name']
    ordering_fields = ['created_at']
