from django.urls import path

from .views import (
    DailySummaryReportViewSet,
    DelinquentCustomerReportViewSet,
    InventoryReportViewSet,
    PurchaseReportViewSet,
)

urlpatterns = [
    path('daily-summary/', DailySummaryReportViewSet.as_view({'get': 'list'}), name='reports-daily-summary'),
    path('inventory/', InventoryReportViewSet.as_view({'get': 'list'}), name='reports-inventory'),
    path('purchases/', PurchaseReportViewSet.as_view({'get': 'list'}), name='reports-purchases'),
    path('delinquent-customers/', DelinquentCustomerReportViewSet.as_view({'get': 'list'}), name='reports-delinquent-customers'),
]
