from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyProfileViewSet, NotificationViewSet, DashboardViewSet

router = DefaultRouter()
router.register(r'company', CompanyProfileViewSet, basename='companyprofile')
router.register(r'notificaciones', NotificationViewSet, basename='notificaciones')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('', include(router.urls)),
]
