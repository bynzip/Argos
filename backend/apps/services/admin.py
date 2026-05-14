from django.contrib import admin

from .models import Service, ServiceCategory, TicketService


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'created_at')
    search_fields = ('nombre',)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nombre', 'category', 'precio_base', 'activo', 'created_at')
    search_fields = ('codigo', 'nombre')
    list_filter = ('activo', 'category')


@admin.register(TicketService)
class TicketServiceAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'service', 'precio_aplicado', 'aplicado_por', 'created_at')
    search_fields = ('ticket__folio', 'service__nombre')

