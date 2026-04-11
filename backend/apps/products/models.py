from django.db import models

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

class Warehouse(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    ubicacion = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'warehouses'

    def __str__(self):
        return self.nombre

class Product(models.Model):
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
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    cantidad = models.IntegerField(default=0)
    ubicacion_especifica = models.CharField(max_length=100, blank=True) # Ej: Pasillo A, Estante 1

    class Meta:
        db_table = 'stock_items'
        unique_together = ('product', 'warehouse')

    def __str__(self):
        return f"{self.product.nombre} en {self.warehouse.nombre}: {self.cantidad}"
