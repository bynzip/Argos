from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, BrandViewSet, WarehouseViewSet, 
    ProductViewSet, ProductSupplierViewSet, StockItemViewSet, StockReservationViewSet, InventoryMovementViewSet
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'brands', BrandViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'product-suppliers', ProductSupplierViewSet, basename='product-supplier')
router.register(r'stock', StockItemViewSet)
router.register(r'reservations', StockReservationViewSet, basename='stock-reservation')
router.register(r'movements', InventoryMovementViewSet, basename='inventory-movement')
router.register(r'', ProductViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
