from django.db import models
from apps.core.models import SoftDeleteModel, TimeStampedModel

class Category(TimeStampedModel):
    """
    Product categories (e.g., Almacenamiento, Pantallas).
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='nombre')
    description = models.TextField(blank=True, verbose_name='descripción')
    is_active = models.BooleanField(default=True, verbose_name='activo')

    class Meta:
        verbose_name = 'categoría'
        verbose_name_plural = 'categorías'

    def __str__(self):
        return self.name

class Brand(TimeStampedModel):
    """
    Product brands (e.g., Kingston, Samsung).
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='nombre')
    is_active = models.BooleanField(default=True, verbose_name='activo')

    class Meta:
        verbose_name = 'marca'
        verbose_name_plural = 'marcas'

    def __str__(self):
        return self.name

class Product(SoftDeleteModel, TimeStampedModel):
    """
    Master product catalog.
    """
    class Unit(models.TextChoices):
        UNIT = 'UNIDAD', 'Unidad'
        METER = 'METRO', 'Metro'
        LITER = 'LITRO', 'Litro'
        PAIR = 'PAR', 'Par'
        BOX = 'CAJA', 'Caja'

    sku = models.CharField(max_length=50, unique=True, verbose_name='código SKU')
    name = models.CharField(max_length=200, verbose_name='nombre')
    category = models.ForeignKey(
        Category, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='products',
        verbose_name='categoría'
    )
    brand = models.ForeignKey(
        Brand, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='products',
        verbose_name='marca'
    )
    description = models.TextField(blank=True, verbose_name='descripción')
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name='precio de costo')
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, verbose_name='precio de venta')
    min_stock = models.DecimalField(max_digits=12, decimal_places=3, default=3.000, verbose_name='stock mínimo')
    is_serializable = models.BooleanField(default=False, verbose_name='es serializable')
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.UNIT, verbose_name='unidad')

    class Meta:
        verbose_name = 'producto'
        verbose_name_plural = 'productos'

    def __str__(self):
        return f"{self.sku} - {self.name}"
