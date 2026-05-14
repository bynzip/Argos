from django.conf import settings
from django.db import models

from apps.customers.models import SoftDeleteModel


class ServiceCategory(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_categories'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Service(SoftDeleteModel):
    codigo = models.CharField(max_length=20, unique=True)
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='services',
    )
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, null=True)
    precio_base = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    horas_estimadas = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'services'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class TicketService(models.Model):
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.CASCADE, related_name='ticket_services')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='ticket_services')
    precio_aplicado = models.DecimalField(max_digits=12, decimal_places=2)
    notas = models.TextField(blank=True, null=True)
    aplicado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applied_ticket_services',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_services'
        unique_together = ('ticket', 'service')
        ordering = ['created_at']

    def __str__(self):
        return f"{self.ticket.folio} - {self.service.nombre}"

