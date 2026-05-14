from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.tickets.views import TicketPagination
from apps.users.permissions import RolePermission

from .models import Service, ServiceCategory
from .serializers import ServiceCategorySerializer, ServiceSerializer


class ServiceCategoryViewSet(viewsets.ModelViewSet):
    queryset = ServiceCategory.objects.filter(activo=True)
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['services.view_list'],
        'retrieve': ['services.view_detail'],
        'create': ['services.create'],
        'update': ['services.edit'],
        'partial_update': ['services.edit'],
        'destroy': ['services.edit'],
    }


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.select_related('category').order_by('nombre')
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['services.view_list'],
        'retrieve': ['services.view_detail'],
        'create': ['services.create'],
        'update': ['services.edit'],
        'partial_update': ['services.edit'],
        'destroy': ['services.edit'],
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'precio_base', 'created_at']

