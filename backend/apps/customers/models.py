from django.db import models
from django.utils import timezone

# Implementación base de soft-delete para cumplir con el requerimiento sin dependencias problemáticas
class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        return super().update(deleted_at=timezone.now(), is_active=False)

    def hard_delete(self):
        return super().delete()

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).filter(deleted_at__isnull=True)

class AllObjectsManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        if hasattr(self, 'is_active'):
            self.is_active = False
        self.save(update_fields=['deleted_at', 'is_active'] if hasattr(self, 'is_active') else ['deleted_at'])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        if hasattr(self, 'is_active'):
            self.is_active = True
        self.save(update_fields=['deleted_at', 'is_active'] if hasattr(self, 'is_active') else ['deleted_at'])


class Customer(SoftDeleteModel):
    CUSTOMER_TYPE_CHOICES = [
        ('PERSONA', 'Persona'),
        ('EMPRESA', 'Empresa'),
    ]
    
    LABEL_CHOICES = [
        ('NUEVO', 'Nuevo'),
        ('REGULAR', 'Regular'),
        ('FRECUENTE', 'Frecuente'),
        ('VIP', 'VIP'),
        ('MOROSO', 'Moroso'),
        ('ESPECIAL', 'Especial'),
    ]

    tipo_cliente = models.CharField(max_length=10, choices=CUSTOMER_TYPE_CHOICES, default='PERSONA')
    identificador = models.CharField(max_length=20)
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    correo_electronico = models.EmailField(max_length=254, null=True, blank=True)
    direccion = models.CharField(max_length=300, null=True, blank=True)
    etiqueta = models.CharField(max_length=20, choices=LABEL_CHOICES, default='NUEVO')
    etiqueta_anterior = models.CharField(max_length=20, choices=LABEL_CHOICES, null=True, blank=True)
    veces_moroso = models.IntegerField(default=0)
    notas = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        constraints = [
            models.UniqueConstraint(
                fields=['identificador'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_customer_identifier'
            )
        ]
        indexes = [
            models.Index(fields=['nombre']),
            models.Index(fields=['etiqueta']),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.identificador})"


class Device(SoftDeleteModel):
    customer = models.ForeignKey(Customer, on_delete=models.RESTRICT, related_name='devices')
    tipo_equipo = models.CharField(max_length=50)
    marca = models.CharField(max_length=80)
    modelo = models.CharField(max_length=120)
    numero_serie = models.CharField(max_length=120, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'devices'
        constraints = [
            models.UniqueConstraint(
                fields=['customer', 'tipo_equipo', 'marca', 'modelo', 'numero_serie'],
                condition=models.Q(deleted_at__isnull=True),
                name='unique_active_device_per_customer'
            )
        ]

    def __str__(self):
        return f"{self.marca} {self.modelo} - {self.customer.nombre}"
