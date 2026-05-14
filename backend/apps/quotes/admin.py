from django.contrib import admin

from .models import Quote, QuoteApproval, QuoteAttachment, QuoteLine, QuoteToTicket


class QuoteLineInline(admin.TabularInline):
    model = QuoteLine
    extra = 0


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ('folio', 'version', 'customer', 'estado', 'total', 'valido_hasta', 'is_active_version')
    search_fields = ('folio', 'customer__nombre', 'customer__identificador')
    list_filter = ('estado', 'is_active_version')
    inlines = [QuoteLineInline]


@admin.register(QuoteApproval)
class QuoteApprovalAdmin(admin.ModelAdmin):
    list_display = ('quote', 'approval_type', 'estado', 'required_level', 'decidido_por', 'decidido_el')
    list_filter = ('approval_type', 'estado')


@admin.register(QuoteAttachment)
class QuoteAttachmentAdmin(admin.ModelAdmin):
    list_display = ('quote', 'nombre_archivo', 'subido_por', 'created_at')


@admin.register(QuoteToTicket)
class QuoteToTicketAdmin(admin.ModelAdmin):
    list_display = ('quote', 'ticket', 'conversion_type', 'convertido_por', 'created_at')
