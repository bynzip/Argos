from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, DeviceViewSet

router = DefaultRouter()
router.register(r'devices', DeviceViewSet, basename='device')
router.register(r'', CustomerViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]
