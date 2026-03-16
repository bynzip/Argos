from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, DeviceViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'devices', DeviceViewSet, basename='device')

urlpatterns = router.urls
