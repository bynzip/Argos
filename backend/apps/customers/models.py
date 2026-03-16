from django.db import models
from apps.core.models import SoftDeleteModel, TimeStampedModel

class Customer(SoftDeleteModel, TimeStampedModel):
    """
    Customers (Natural Persons or Companies) interacting with Argos.
    """
    class CustomerType(models.TextChoices):
        PERSON = 'PERSONA', 'Persona Natural'
        COMPANY = 'EMPRESA', 'Empresa'

    class Label(models.TextChoices):
        NEW = 'NUEVO', 'Nuevo'
        REGULAR = 'REGULAR', 'Regular'
        FREQUENT = 'FRECUENTE', 'Frecuente'
        VIP = 'VIP', 'VIP'
        MOROSO = 'MOROSO', 'Moroso'
        SPECIAL = 'ESPECIAL', 'Especial'

    customer_type = models.CharField(
        max_length=10, 
        choices=CustomerType.choices, 
        default=CustomerType.PERSON,
        verbose_name='tipo de cliente'
    )
    identifier = models.CharField(max_length=20, unique=True, verbose_name='DNI/RUC')
    name = models.CharField(max_length=150, verbose_name='nombre / razón social')
    phone = models.CharField(max_length=20, blank=True, verbose_name='teléfono')
    email = models.EmailField(blank=True, verbose_name='correo electrónico')
    address = models.CharField(max_length=300, blank=True, verbose_name='dirección')
    
    label = models.CharField(
        max_length=20, 
        choices=Label.choices, 
        default=Label.NEW,
        verbose_name='etiqueta'
    )
    previous_label = models.CharField(max_length=20, blank=True, verbose_name='etiqueta anterior')
    times_moroso = models.IntegerField(default=0, verbose_name='veces moroso')
    notes = models.TextField(blank=True, verbose_name='notas')

    class Meta:
        verbose_name = 'cliente'
        verbose_name_plural = 'clientes'

    def __str__(self):
        return f"{self.name} ({self.identifier})"

class Device(SoftDeleteModel, TimeStampedModel):
    """
    Equipment registered to customers.
    """
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.CASCADE, 
        related_name='devices', 
        verbose_name='cliente'
    )
    device_type = models.CharField(max_length=50, verbose_name='tipo de equipo')
    brand = models.CharField(max_length=80, verbose_name='marca')
    model = models.CharField(max_length=120, verbose_name='modelo')
    serial_number = models.CharField(max_length=120, blank=True, verbose_name='número de serie')
    notes = models.TextField(blank=True, verbose_name='notas')

    class Meta:
        verbose_name = 'dispositivo'
        verbose_name_plural = 'dispositivos'
        unique_together = ('customer', 'device_type', 'brand', 'model', 'serial_number')

    def __str__(self):
        return f"{self.device_type} {self.brand} {self.model} - {self.customer.name}"
