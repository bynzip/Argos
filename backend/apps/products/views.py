from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RolePermission
from django.db.models import Sum
from django.db.models.functions import Coalesce
from apps.tickets.views import TicketPagination

from .models import Category, Brand, Warehouse, Product, StockItem
from .serializers import (
    CategorySerializer, BrandSerializer, WarehouseSerializer, 
    ProductSerializer, StockItemSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(activo=True)
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
    }

class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.filter(activo=True)
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
    }

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.manage_movements'],
        'update': ['inventory.manage_movements'],
        'partial_update': ['inventory.manage_movements'],
        'destroy': ['inventory.manage_movements'],
    }

class ProductViewSet(viewsets.ModelViewSet):
    """
    CRUD de Catálogo de Productos con búsqueda y filtros.
    """
    queryset = Product.objects.annotate(
        total_stock_db=Coalesce(Sum('stocks__cantidad'), 0)
    ).order_by('-created_at')
    
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ['codigo', 'nombre', 'brand__nombre', 'descripcion']
    filterset_fields = ['category', 'brand', 'activo']
    ordering_fields = ['nombre', 'precio_venta', 'created_at']

class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_stock'],
        'retrieve': ['inventory.view_stock'],
        'create': ['inventory.manage_movements'],
        'update': ['inventory.manage_movements'],
        'partial_update': ['inventory.manage_movements'],
        'destroy': ['inventory.manage_movements'],
    }
    filterset_fields = ['product', 'warehouse']
