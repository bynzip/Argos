from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.db.models.functions import Coalesce

from .models import Category, Brand, Warehouse, Product, StockItem
from .serializers import (
    CategorySerializer, BrandSerializer, WarehouseSerializer, 
    ProductSerializer, StockItemSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(activo=True)
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.filter(activo=True)
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]

class ProductViewSet(viewsets.ModelViewSet):
    """
    CRUD de Catálogo de Productos con búsqueda y filtros.
    """
    queryset = Product.objects.annotate(
        total_stock_db=Coalesce(Sum('stocks__cantidad'), 0)
    ).order_by('-created_at')
    
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ['codigo', 'nombre', 'brand__nombre', 'descripcion']
    filterset_fields = ['category', 'brand', 'activo']
    ordering_fields = ['nombre', 'precio_venta', 'created_at']

class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['product', 'warehouse']
