from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import AuditLog, CompanyProfile


CompanyProfile._meta.verbose_name = 'Perfil de empresa'
CompanyProfile._meta.verbose_name_plural = 'Perfil de empresa'
AuditLog._meta.verbose_name = 'Registro de auditoria'
AuditLog._meta.verbose_name_plural = 'Auditoria'


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
    readonly_fields = ('updated_by', 'created_at', 'updated_at')
    fieldsets = (
        ('Datos de empresa', {
            'fields': ('business_name', 'legal_name', 'ruc', 'phone', 'email', 'address'),
        }),
        ('Cotizaciones', {
            'fields': ('quote_default_validity_days', 'quote_default_igv', 'quote_approval_threshold_amount', 'quote_default_terms'),
        }),
        ('Cochera', {
            'fields': ('cochera_grace_days', 'cochera_daily_rate'),
        }),
        ('Credito y morosidad', {
            'fields': ('credit_grace_days', 'credit_morosidad_limit'),
        }),
        ('Auditoria', {
            'fields': ('updated_by', 'created_at', 'updated_at'),
        }),
    )

    def has_add_permission(self, request):
        return not self.model.objects.exists()

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(AuditLog)
class AuditLogAdmin(BaseAdmin):
    list_display = ('created_at', 'module', 'action', 'object_repr', 'user')
    list_filter = ('module', 'action', 'created_at')
    search_fields = ('object_repr', 'object_id', 'model_name', 'user__username', 'user__nombre')
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
