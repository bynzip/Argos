from django.db import models
from django.conf import settings

class SoftDeleteModel(models.Model):
    """
    Abstract model to provide soft delete functionality.
    """
    is_active = models.BooleanField(default=True, verbose_name='activo')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='fecha de eliminación')

    class Meta:
        abstract = True

class TimeStampedModel(models.Model):
    """
    Abstract model to provide creation and update timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='fecha de creación')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='fecha de actualización')

    class Meta:
        abstract = True

class Area(TimeStampedModel):
    """
    Physical or logical area of the business (e.g., Taller, Ventas).
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='nombre')
    description = models.TextField(blank=True, verbose_name='descripción')
    is_active = models.BooleanField(default=True, verbose_name='activo')

    class Meta:
        verbose_name = 'área'
        verbose_name_plural = 'áreas'

    def __str__(self):
        return self.name

class SubArea(TimeStampedModel):
    """
    Subdivisions of an area (e.g., within Taller -> Diagnóstico, Ensamblaje).
    """
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='subareas', verbose_name='área')
    name = models.CharField(max_length=100, verbose_name='nombre')
    max_capacity = models.IntegerField(null=True, blank=True, verbose_name='capacidad máxima')
    current_load = models.IntegerField(default=0, verbose_name='carga actual')
    is_active = models.BooleanField(default=True, verbose_name='activo')

    class Meta:
        verbose_name = 'subárea'
        verbose_name_plural = 'subáreas'
        unique_together = ('area', 'name')

    def __str__(self):
        return f"{self.area.name} - {self.name}"

class CompanyProfile(TimeStampedModel):
    """
    Company data and global settings. Only one row should exist.
    """
    business_name = models.CharField(max_length=150, verbose_name='nombre comercial')
    legal_name = models.CharField(max_length=200, verbose_name='razón social')
    ruc = models.CharField(max_length=20, verbose_name='RUC')
    address = models.TextField(verbose_name='dirección')
    phone = models.CharField(max_length=20, verbose_name='teléfono')
    whatsapp = models.CharField(max_length=20, verbose_name='WhatsApp / celular')
    email = models.EmailField(verbose_name='correo electrónico')
    website = models.URLField(blank=True, verbose_name='sitio web')
    logo = models.ImageField(upload_to='company/logos/', null=True, blank=True, verbose_name='logo')
    signature = models.ImageField(upload_to='company/signatures/', null=True, blank=True, verbose_name='firma')
    
    # Global settings
    cochera_grace_days = models.IntegerField(default=7, verbose_name='días de gracia cochera')
    cochera_daily_rate = models.DecimalField(max_digits=12, decimal_places=2, default=2.00, verbose_name='tarifa diaria cochera')
    quote_default_validity_days = models.IntegerField(default=15, verbose_name='días de validez cotizaciones')
    quote_default_igv = models.DecimalField(max_digits=5, decimal_places=2, default=18.00, verbose_name='IGV por defecto (%)')
    credit_grace_days = models.IntegerField(default=3, verbose_name='días de gracia tras vencimiento cuota')
    credit_morosidad_limit = models.IntegerField(default=3, verbose_name='límite de veces en mora para Especial')
    
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name='actualizado por'
    )

    class Meta:
        verbose_name = 'perfil de empresa'
        verbose_name_plural = 'perfil de empresa'

    def __str__(self):
        return self.business_name
