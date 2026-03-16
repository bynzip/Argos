from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Category, Brand, Product

class BaseAdmin(ImportExportModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Category)
class CategoryAdmin(BaseAdmin):
    list_display = ('name', 'is_active', 'created_at')
    search_fields = ('name',)

@admin.register(Brand)
class BrandAdmin(BaseAdmin):
    list_display = ('name', 'is_active')
    search_fields = ('name',)

@admin.register(Product)
class ProductAdmin(BaseAdmin):
    list_display = ('sku', 'name', 'category', 'brand', 'sale_price', 'is_active')
    list_filter = ('category', 'brand', 'is_active', 'is_serializable')
    search_fields = ('sku', 'name')
    ordering = ('sku',)
