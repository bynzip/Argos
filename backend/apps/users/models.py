from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """
    Custom User model for Argos ERP.
    """
    first_name = models.CharField(max_length=150, verbose_name='nombre')
    last_name = models.CharField(max_length=150, verbose_name='apellidos', blank=True)
    email = models.EmailField(unique=True, verbose_name='correo electrónico')
    
    # Custom fields from planning
    subarea = models.ForeignKey(
        'core.SubArea', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='staff',
        verbose_name='subárea'
    )
    active_tickets_count = models.IntegerField(default=0, verbose_name='cantidad de tickets activos')
    
    class Meta:
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.username})"
