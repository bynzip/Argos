from rest_framework.routers import DefaultRouter
from .views import AreaViewSet, SubAreaViewSet, CompanyProfileViewSet, DashboardViewSet

router = DefaultRouter()
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'subareas', SubAreaViewSet, basename='subarea')
router.register(r'profile', CompanyProfileViewSet, basename='profile')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = router.urls
