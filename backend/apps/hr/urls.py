from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AttendanceCorrectionViewSet, AttendanceViewSet, ObservationViewSet, WorkScheduleViewSet

router = DefaultRouter()
router.register(r'schedules', WorkScheduleViewSet, basename='work-schedule')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'corrections', AttendanceCorrectionViewSet, basename='attendance-correction')
router.register(r'observations', ObservationViewSet, basename='observation')

urlpatterns = [
    path('', include(router.urls)),
]
