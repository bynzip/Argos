from django.urls import path
from .views import CashClosureViewSet, CocheraChargeViewSet, DiscountViewSet, PaymentReversalViewSet, PaymentScheduleViewSet, PaymentViewSet

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
    path('tickets/<uuid:ticket_id>/schedules/', PaymentScheduleViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='ticket-schedules'),
    path('tickets/<uuid:ticket_id>/schedules/<int:pk>/reprogram/', PaymentScheduleViewSet.as_view({
        'post': 'reprogram',
    }), name='ticket-schedule-reprogram'),
    path('discounts/', DiscountViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='discount-list'),
    path('discounts/<int:pk>/approve/', DiscountViewSet.as_view({
        'post': 'approve',
    }), name='discount-approve'),
    path('discounts/<int:pk>/reject/', DiscountViewSet.as_view({
        'post': 'reject',
    }), name='discount-reject'),
    path('reversals/', PaymentReversalViewSet.as_view({
        'get': 'list',
        'post': 'create',
    }), name='reversal-list'),
    path('reversals/<int:pk>/approve/', PaymentReversalViewSet.as_view({
        'post': 'approve',
    }), name='reversal-approve'),
    path('reversals/<int:pk>/reject/', PaymentReversalViewSet.as_view({
        'post': 'reject',
    }), name='reversal-reject'),
    path('tickets/<uuid:ticket_id>/cochera/', CocheraChargeViewSet.as_view({
        'get': 'list',
    }), name='ticket-cochera'),
    path('tickets/<uuid:ticket_id>/cochera/generate/', CocheraChargeViewSet.as_view({
        'post': 'generate',
    }), name='ticket-cochera-generate'),
]
