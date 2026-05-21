from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChecklistTemplateViewSet, TicketViewSet

router = DefaultRouter()
router.register(r'checklist-templates', ChecklistTemplateViewSet, basename='checklist-template')
router.register(r'', TicketViewSet, basename='ticket')

urlpatterns = [
    path('', include(router.urls)),
]
