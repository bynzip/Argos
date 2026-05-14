from django.conf import settings
from django.db import models

from apps.customers.models import Device, SoftDeleteModel
from apps.products.models import Product
from apps.services.models import Service


class Quote(SoftDeleteModel):
    class QuoteStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Borrador'
        SENT = 'SENT', 'Enviada'
        APPROVED = 'APPROVED', 'Aprobada'
        REJECTED = 'REJECTED', 'Rechazada'
        EXPIRED = 'EXPIRED', 'Vencida'
        CONVERTED = 'CONVERTED', 'Convertida'

    folio = models.CharField(max_length=20)
    version = models.IntegerField(default=1)
    base_quote = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='versions')
    customer = models.ForeignKey('customers.Customer', on_delete=models.RESTRICT, related_name='quotes')
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes')
    source_ticket = models.ForeignKey('tickets.Ticket', on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_quotes',
    )
    estado = models.CharField(max_length=20, choices=QuoteStatus.choices, default=QuoteStatus.DRAFT)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    igv_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    igv_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valido_hasta = models.DateField(null=True, blank=True)
    condiciones = models.TextField(blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    is_active_version = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'quotes'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['folio', 'version'], name='unique_quote_folio_version'),
        ]
        indexes = [
            models.Index(fields=['folio']),
            models.Index(fields=['customer']),
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f"{self.folio} v{self.version}"


class QuoteLine(models.Model):
    class LineType(models.TextChoices):
        PRODUCT = 'PRODUCT', 'Producto'
        SERVICE = 'SERVICE', 'Servicio'

    class SupplyStatus(models.TextChoices):
        NOT_APPLICABLE = 'NOT_APPLICABLE', 'No aplica'
        RESERVED = 'RESERVED', 'Reservado'
        OUT_OF_STOCK = 'OUT_OF_STOCK', 'Sin stock'
        PENDING_ORDER = 'PENDING_ORDER', 'Orden pendiente'

    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='lines')
    line_type = models.CharField(max_length=10, choices=LineType.choices)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='quote_lines')
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='quote_lines')
    descripcion = models.TextField()
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento_linea = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_linea = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supply_status = models.CharField(
        max_length=20,
        choices=SupplyStatus.choices,
        default=SupplyStatus.NOT_APPLICABLE,
    )
    orden = models.IntegerField(default=0)

    class Meta:
        db_table = 'quote_lines'
        ordering = ['orden', 'id']


class QuoteApproval(models.Model):
    class ApprovalType(models.TextChoices):
        AMOUNT = 'AMOUNT', 'Monto'
        DISCOUNT = 'DISCOUNT', 'Descuento'
        SPECIAL = 'SPECIAL', 'Especial'

    class ApprovalLevel(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrador'

    class ApprovalStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pendiente'
        APPROVED = 'APPROVED', 'Aprobada'
        REJECTED = 'REJECTED', 'Rechazada'

    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='approvals')
    approval_type = models.CharField(max_length=20, choices=ApprovalType.choices)
    required_level = models.CharField(max_length=20, choices=ApprovalLevel.choices, default=ApprovalLevel.ADMIN)
    estado = models.CharField(max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    decidido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decided_quote_approvals',
    )
    decidido_el = models.DateTimeField(null=True, blank=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quote_approvals'
        ordering = ['-created_at']


class QuoteAttachment(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='attachments')
    archivo = models.FileField(upload_to='quotes/attachments/%Y/%m/%d/', max_length=500)
    nombre_archivo = models.CharField(max_length=255)
    tamano_archivo = models.IntegerField(null=True, blank=True)
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_quote_attachments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quote_attachments'
        ordering = ['created_at']


class QuoteToTicket(models.Model):
    class ConversionType(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'Individual'

    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='ticket_links')
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.CASCADE, related_name='quote_links')
    conversion_type = models.CharField(max_length=20, choices=ConversionType.choices, default=ConversionType.INDIVIDUAL)
    convertido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='converted_quotes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'quote_to_tickets'
        unique_together = ('quote', 'ticket')

