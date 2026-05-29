from django.contrib import admin
from .models import Customer, Device


Customer._meta.verbose_name = 'Cliente'
Customer._meta.verbose_name_plural = 'Clientes'
Device._meta.verbose_name = 'Equipo'
Device._meta.verbose_name_plural = 'Equipos'


class ReadOnlySupportAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Customer)
class CustomerAdmin(ReadOnlySupportAdmin):
    list_display = ('identificador', 'nombre', 'tipo_cliente', 'etiqueta', 'is_active', 'deleted_at')
    list_filter = ('tipo_cliente', 'etiqueta', 'is_active')
    search_fields = ('identificador', 'nombre', 'correo_electronico', 'telefono')
    
    def get_queryset(self, request):
        # Para que el admin pueda ver y restaurar eliminados también
        return Customer.all_objects.all()

@admin.register(Device)
class DeviceAdmin(ReadOnlySupportAdmin):
    list_display = ('tipo_equipo', 'marca', 'modelo', 'numero_serie', 'customer', 'is_active')
    list_filter = ('tipo_equipo', 'marca', 'is_active')
    search_fields = ('marca', 'modelo', 'numero_serie', 'customer__nombre', 'customer__identificador')

    def get_queryset(self, request):
        return Device.all_objects.all()
