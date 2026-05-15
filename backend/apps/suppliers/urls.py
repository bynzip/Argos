from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PurchaseOrderViewSet, SupplierViewSet

router = DefaultRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'', SupplierViewSet, basename='supplier')

urlpatterns = [
    path('', include(router.urls)),
]
