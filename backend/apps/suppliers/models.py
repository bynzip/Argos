from django.conf import settings
from django.db import models

from apps.customers.models import SoftDeleteModel


class Supplier(SoftDeleteModel):
    nombre = models.CharField(max_length=150)
    ruc = models.CharField(max_length=20, unique=True)
    contacto = models.CharField(max_length=150, blank=True, default='')
    telefono = models.CharField(max_length=20, blank=True, default='')
    correo = models.EmailField(blank=True, default='')
    direccion = models.CharField(max_length=255, blank=True, default='')
    notas = models.TextField(blank=True, default='')
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class PurchaseOrder(SoftDeleteModel):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Borrador'
        SENT = 'SENT', 'Enviada'
        PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', 'Parcialmente recibida'
        CLOSED_INCOMPLETE = 'CLOSED_INCOMPLETE', 'Cerrada incompleta'
        RECEIVED = 'RECEIVED', 'Recibida'
        CANCELLED = 'CANCELLED', 'Cancelada'

    folio = models.CharField(max_length=20, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.RESTRICT, related_name='purchase_orders')
    destination_warehouse = models.ForeignKey(
        'products.Warehouse',
        on_delete=models.RESTRICT,
        related_name='purchase_orders',
    )
    estado = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_purchase_orders',
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-created_at']

    def __str__(self):
        return self.folio


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.RESTRICT, related_name='purchase_order_items')
    cantidad_pedida = models.DecimalField(max_digits=12, decimal_places=3)
    cantidad_recibida = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    serial_numbers = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'purchase_order_items'


class PurchaseOrderStatusHistory(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='status_history')
    estado_anterior = models.CharField(max_length=30, blank=True, default='')
    estado_nuevo = models.CharField(max_length=30, choices=PurchaseOrder.Status.choices)
    cambiado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_order_status_changes',
    )
    motivo = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'purchase_order_status_history'
        ordering = ['-created_at']
