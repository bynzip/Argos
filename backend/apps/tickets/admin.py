from django.contrib import admin

from .models import ChecklistTemplate, ChecklistTemplateItem


ChecklistTemplate._meta.verbose_name = 'Plantilla de checklist'
ChecklistTemplate._meta.verbose_name_plural = 'Plantillas de checklist'
ChecklistTemplateItem._meta.verbose_name = 'Item de plantilla'
ChecklistTemplateItem._meta.verbose_name_plural = 'Items de plantilla'


class ChecklistTemplateItemInline(admin.TabularInline):
    model = ChecklistTemplateItem
    extra = 1
    fields = ('orden', 'nombre', 'requerido')
    verbose_name = 'Item'
    verbose_name_plural = 'Items'


@admin.register(ChecklistTemplate)
class ChecklistTemplateAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'items_count', 'updated_at')
    list_filter = ('activo',)
    search_fields = ('nombre', 'descripcion')
    readonly_fields = ('created_at', 'updated_at')
    inlines = (ChecklistTemplateItemInline,)
    fieldsets = (
        ('Plantilla', {'fields': ('nombre', 'descripcion', 'activo')}),
        ('Auditoria', {'fields': ('created_at', 'updated_at')}),
    )

    def items_count(self, obj):
        return obj.items.count()

    items_count.short_description = 'Items'


@admin.register(ChecklistTemplateItem)
class ChecklistTemplateItemAdmin(admin.ModelAdmin):
    list_display = ('template', 'orden', 'nombre', 'requerido', 'updated_at')
    list_filter = ('template', 'requerido')
    search_fields = ('nombre', 'template__nombre')
    autocomplete_fields = ('template',)
    readonly_fields = ('created_at', 'updated_at')
