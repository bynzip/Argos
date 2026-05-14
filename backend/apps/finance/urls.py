from django.urls import path
from .views import CashClosureViewSet, PaymentViewSet

urlpatterns = [
    # Caja routes
    path('caja/', CashClosureViewSet.as_view({'get': 'list'}), name='caja-estado'),
    path('caja/abrir/', CashClosureViewSet.as_view({'post': 'open'}), name='caja-abrir'),
    path('caja/cerrar/', CashClosureViewSet.as_view({'post': 'close'}), name='caja-cerrar'),
    
    # Payments for a ticket
    path('tickets/<uuid:ticket_id>/pagos/', PaymentViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='ticket-pagos'),
    path('pagos/<int:pk>/confirm/', PaymentViewSet.as_view({
        'post': 'confirm'
    }), name='confirmar-pago'),
]
