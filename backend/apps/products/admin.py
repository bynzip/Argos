from django import forms
from django.contrib import admin
from django.db.models import Sum

from .models import (
    Brand,
    Category,
    InventoryMovement,
    Product,
    ProductSupplier,
    StockItem,
    StockReservation,
    Warehouse,
)


class StockItemInline(admin.TabularInline):
    model = StockItem
    extra = 1
    verbose_name = 'Stock disponible'
    verbose_name_plural = 'Stock por almacenes'


class ProductAdminForm(forms.ModelForm):
    stock_disponible_al_crear = forms.DecimalField(
        required=False,
        initial=0,
        decimal_places=3,
        max_digits=12,
        help_text='Opcional: si estás creando el producto, puedes registrar stock inicial aquí.'
    )

    class Meta:
        model = Product
        fields = '__all__'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ('codigo', 'nombre', 'category', 'brand', 'precio_venta', 'get_stock', 'stock_minimo', 'activo')
    list_filter = ('category', 'brand', 'activo')
    search_fields = ('codigo', 'nombre', 'descripcion')
    readonly_fields = ('codigo',)
    inlines = [StockItemInline]

    def get_stock(self, obj):
        total = obj.stocks.aggregate(total=Sum('cantidad'))['total']
        return total if total else 0

    get_stock.short_description = 'Stock Total'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        stock_rapido = form.cleaned_data.get('stock_disponible_al_crear')
        if stock_rapido and stock_rapido > 0:
            warehouse, _ = Warehouse.objects.get_or_create(nombre='Almacén Principal', defaults={'ubicacion': 'Sede Central'})
            stock_item, created = StockItem.objects.get_or_create(
                product=obj,
                warehouse=warehouse,
                defaults={'cantidad': stock_rapido}
            )
            if not created:
                stock_item.cantidad = stock_rapido
                stock_item.save()


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'ubicacion')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')


@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'stock_item', 'cantidad', 'estado', 'reservado_por', 'created_at')
    list_filter = ('estado', 'stock_item__warehouse')
    search_fields = ('ticket__folio', 'stock_item__product__nombre')


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'movement_type', 'quantity', 'reference_type', 'created_at')
    list_filter = ('movement_type', 'warehouse')
    search_fields = ('product__nombre', 'product__codigo', 'reference_id')
    readonly_fields = ('created_at',)


@admin.register(ProductSupplier)
class ProductSupplierAdmin(admin.ModelAdmin):
    list_display = ('product', 'supplier', 'supplier_id_legacy', 'supplier_price', 'lead_time_days', 'is_primary')
    list_filter = ('is_primary',)
