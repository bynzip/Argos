from django.contrib import admin

from .models import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatusHistory, Supplier


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'ruc', 'contacto', 'telefono', 'correo', 'activo')
    search_fields = ('nombre', 'ruc', 'contacto')


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('folio', 'supplier', 'destination_warehouse', 'estado', 'subtotal', 'created_at')
    list_filter = ('estado', 'destination_warehouse')
    search_fields = ('folio', 'supplier__nombre')
    inlines = [PurchaseOrderItemInline]


@admin.register(PurchaseOrderStatusHistory)
class PurchaseOrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('purchase_order', 'estado_anterior', 'estado_nuevo', 'cambiado_por', 'created_at')
