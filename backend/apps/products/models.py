from django.db import models
from apps.customers.models import SoftDeleteModel
from django.conf import settings
from django.utils import timezone

class Category(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.nombre

class Brand(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'brands'

    def __str__(self):
        return self.nombre

class Warehouse(SoftDeleteModel):
    nombre = models.CharField(max_length=100, unique=True)
    ubicacion = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'warehouses'

    def __str__(self):
        return self.nombre

class Product(SoftDeleteModel):
    codigo = models.CharField(max_length=50, unique=True) # Generado por sistema (ej: PROD-0001)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True)
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2)
    stock_minimo = models.IntegerField(default=5)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class StockItem(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stocks')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='stock_items')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    reservado = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    costo_promedio = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    ubicacion_especifica = models.CharField(max_length=100, blank=True) # Ej: Pasillo A, Estante 1
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock_items'
        unique_together = ('product', 'warehouse')

    @property
    def disponible(self):
        return self.cantidad - self.reservado

    def __str__(self):
        return f"{self.product.nombre} en {self.warehouse.nombre}: {self.cantidad}"


class StockReservation(models.Model):
    class ReservationStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Activa'
        CONSUMED = 'CONSUMED', 'Consumida'
        RELEASED = 'RELEASED', 'Liberada'

    stock_item = models.ForeignKey(StockItem, on_delete=models.RESTRICT, related_name='reservations')
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.RESTRICT, related_name='stock_reservations')
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    estado = models.CharField(max_length=20, choices=ReservationStatus.choices, default=ReservationStatus.ACTIVE)
    reservado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_stock_reservations'
    )
    notas = models.TextField(blank=True)
    consumido_el = models.DateTimeField(null=True, blank=True)
    liberado_el = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_reservations'
        indexes = [
            models.Index(fields=['ticket']),
            models.Index(fields=['stock_item']),
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f"Reserva {self.ticket.folio} - {self.stock_item.product.nombre} ({self.cantidad})"


class InventoryMovement(models.Model):
    class MovementType(models.TextChoices):
        ENTRY = 'ENTRY', 'Entrada'
        EXIT = 'EXIT', 'Salida'
        TRANSFER_OUT = 'TRANSFER_OUT', 'Transferencia salida'
        TRANSFER_IN = 'TRANSFER_IN', 'Transferencia entrada'
        ADJUSTMENT_IN = 'ADJUSTMENT_IN', 'Ajuste entrada'
        ADJUSTMENT_OUT = 'ADJUSTMENT_OUT', 'Ajuste salida'
        RETURN = 'RETURN', 'Devolución'

    product = models.ForeignKey(Product, on_delete=models.RESTRICT, related_name='inventory_movements')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.RESTRICT, related_name='inventory_movements')
    destination_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name='incoming_inventory_movements'
    )
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    serial_numbers = models.JSONField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_movements'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_movements'
        indexes = [
            models.Index(fields=['product']),
            models.Index(fields=['warehouse']),
            models.Index(fields=['movement_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['reference_type', 'reference_id']),
        ]

    def __str__(self):
        return f"{self.product.codigo} - {self.movement_type} ({self.quantity})"


class ProductSupplier(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='product_suppliers')
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_suppliers',
    )
    supplier_id_legacy = models.BigIntegerField(null=True, blank=True)
    supplier_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    lead_time_days = models.IntegerField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_suppliers'
        constraints = [
            models.UniqueConstraint(
                fields=['product', 'supplier'],
                condition=models.Q(supplier__isnull=False),
                name='unique_product_supplier_when_supplier_present',
            )
        ]

    def __str__(self):
        supplier_name = self.supplier.nombre if self.supplier_id else f"proveedor legado {self.supplier_id_legacy}"
        return f"{self.product.codigo} -> {supplier_name}"
