from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QuoteViewSet, TicketQuoteViewSet

router = DefaultRouter()
router.register(r'', QuoteViewSet, basename='quote')

ticket_quote_view = TicketQuoteViewSet.as_view({'get': 'list', 'post': 'create'})

urlpatterns = [
    path('tickets/<uuid:ticket_pk>/quotes/', ticket_quote_view, name='ticket-quotes'),
    path('', include(router.urls)),
]
