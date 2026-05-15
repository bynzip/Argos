from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import AuditLog, CompanyProfile


class BaseAdmin(ImportExportModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CompanyProfile)
class CompanyProfileAdmin(BaseAdmin):
    list_display = (
        'business_name',
        'legal_name',
        'ruc',
        'phone',
        'email',
        'quote_default_validity_days',
        'quote_default_igv',
        'quote_approval_threshold_amount',
        'cochera_grace_days',
        'cochera_daily_rate',
    )
    readonly_fields = ('created_at', 'updated_at')

    def has_add_permission(self, request):
        return not self.model.objects.exists()


@admin.register(AuditLog)
class AuditLogAdmin(BaseAdmin):
    list_display = ('created_at', 'module', 'action', 'object_repr', 'user')
    list_filter = ('module', 'action')
    search_fields = ('object_repr', 'object_id', 'model_name')
    readonly_fields = (
        'user',
        'action',
        'module',
        'model_name',
        'object_id',
        'object_repr',
        'before_data',
        'after_data',
        'extra',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
