from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Area, SubArea, CompanyProfile

class BaseAdmin(ImportExportModelAdmin):
    """
    Base Admin class to provide common functionality like Export and Soft Delete UI.
    """
    def has_delete_permission(self, request, obj=None):
        # Disable physical delete button in the UI
        return False

@admin.register(Area)
class AreaAdmin(BaseAdmin):
    list_display = ('name', 'is_active', 'created_at')
    search_fields = ('name',)

@admin.register(SubArea)
class SubAreaAdmin(BaseAdmin):
    list_display = ('name', 'area', 'current_load', 'is_active')
    list_filter = ('area', 'is_active')
    search_fields = ('name',)

@admin.register(CompanyProfile)
class CompanyProfileAdmin(BaseAdmin):
    list_display = ('business_name', 'ruc', 'phone', 'email')
    readonly_fields = ('created_at', 'updated_at')

    def has_add_permission(self, request):
        if self.model.objects.exists():
            return False
        return True
