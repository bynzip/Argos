from django.contrib import admin

from .models import Brand, Category


Category._meta.verbose_name = 'Categoria de producto'
Category._meta.verbose_name_plural = 'Categorias de producto'
Brand._meta.verbose_name = 'Marca'
Brand._meta.verbose_name_plural = 'Marcas'


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre', 'descripcion')
    fieldsets = (
        ('Categoria', {'fields': ('nombre', 'descripcion', 'activo')}),
    )


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    list_filter = ('activo',)
    search_fields = ('nombre',)
