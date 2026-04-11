from django import forms
from django.contrib import admin
from .models import Category, Brand, Warehouse, Product, StockItem

class StockItemInline(admin.TabularInline):
    model = StockItem
    extra = 1 # ESTO ES CLAVE: Muestra una fila vacía para poder escribir el stock
    verbose_name = "Stock disponible"
    verbose_name_plural = "Stock por almacenes"

class ProductAdminForm(forms.ModelForm):
    stock_disponible_al_crear = forms.IntegerField(
        required=False, 
        initial=0, 
        help_text="Opcional: Si está creando el producto, puede poner el stock aquí directamente."
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
    
    # Inlines para ver y editar el stock real
    inlines = [StockItemInline]

    def get_stock(self, obj):
        from django.db.models import Sum
        total = obj.stocks.aggregate(total=Sum('cantidad'))['total']
        return total if total else 0
    get_stock.short_description = 'Stock Total'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        # Lógica para el campo rápido de stock
        stock_rápido = form.cleaned_data.get('stock_disponible_al_crear')
        if stock_rápido and stock_rápido > 0:
            warehouse, _ = Warehouse.objects.get_or_create(nombre="Almacén Principal")
            stock_item, created = StockItem.objects.get_or_create(
                product=obj,
                warehouse=warehouse,
                defaults={'cantidad': stock_rápido}
            )
            if not created:
                stock_item.cantidad = stock_rápido
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
