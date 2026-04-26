from django.contrib import admin
from .models import (
    CashClosure, Receipt, PaymentVoucher, PaymentReversal,
    PaymentSchedule, PaymentScheduleReprogramacion, ReceiptScheduleItem,
    Discount, CocheraCharge
)

@admin.register(CashClosure)
class CashClosureAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'estado', 'opening_amount', 'expected_amount', 'declared_amount', 'opened_at')
    list_filter = ('estado',)

@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ('folio', 'tipo_recibo', 'metodo_pago', 'amount', 'estado', 'created_at')
    list_filter = ('estado', 'metodo_pago', 'tipo_recibo')
    search_fields = ('folio', 'referencia')

admin.site.register(PaymentVoucher)
admin.site.register(PaymentReversal)
admin.site.register(PaymentSchedule)
admin.site.register(PaymentScheduleReprogramacion)
admin.site.register(ReceiptScheduleItem)
admin.site.register(Discount)
admin.site.register(CocheraCharge)
