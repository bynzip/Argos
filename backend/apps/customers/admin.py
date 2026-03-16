from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Customer, Device

class BaseAdmin(ImportExportModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Customer)
class CustomerAdmin(BaseAdmin):
    list_display = ('name', 'identifier', 'customer_type', 'label', 'is_active')
    list_filter = ('customer_type', 'label', 'is_active')
    search_fields = ('name', 'identifier', 'phone')
    ordering = ('-created_at',)

@admin.register(Device)
class DeviceAdmin(BaseAdmin):
    list_display = ('device_type', 'brand', 'model', 'customer', 'is_active')
    list_filter = ('device_type', 'brand', 'is_active')
    search_fields = ('model', 'serial_number', 'customer__name')
