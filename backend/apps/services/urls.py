from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ServiceCategoryViewSet, ServiceViewSet

router = DefaultRouter()
router.register(r'categories', ServiceCategoryViewSet)
router.register(r'', ServiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

