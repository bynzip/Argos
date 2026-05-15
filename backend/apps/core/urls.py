from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuditLogViewSet, CompanyProfileViewSet, DashboardViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r'company', CompanyProfileViewSet, basename='companyprofile')
router.register(r'notificaciones', NotificationViewSet, basename='notificaciones')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
