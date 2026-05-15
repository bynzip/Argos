from django.conf import settings
from django.db import models
from django.utils import timezone


class FolioCounter(models.Model):
    document_type = models.CharField(max_length=10, default='TKT')
    year = models.IntegerField(default=0)
    last_number = models.IntegerField(default=0)

    class Meta:
        db_table = 'folio_counters'
        unique_together = ['document_type', 'year']

    @classmethod
    def get_next_folio(cls, document_type):
        from django.db import transaction

        year = timezone.now().year
        with transaction.atomic():
            counter, _ = cls.objects.select_for_update().get_or_create(
                document_type=document_type,
                year=year,
                defaults={'last_number': 0},
            )
            counter.last_number += 1
            counter.save(update_fields=['last_number'])
            return f"{document_type}-{year}-{str(counter.last_number).zfill(4)}"


class CompanyProfile(models.Model):
    business_name = models.CharField(max_length=100)
    legal_name = models.CharField(max_length=150, blank=True, default='')
    ruc = models.CharField(max_length=15)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    address = models.CharField(max_length=255, blank=True, default='')
    quote_default_validity_days = models.IntegerField(default=15)
    quote_default_igv = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    quote_approval_threshold_amount = models.DecimalField(max_digits=12, decimal_places=2, default=1500)
    quote_default_terms = models.TextField(blank=True, default='')
    cochera_grace_days = models.IntegerField(default=7)
    cochera_daily_rate = models.DecimalField(max_digits=12, decimal_places=2, default=2)
    credit_grace_days = models.IntegerField(default=3)
    credit_morosidad_limit = models.IntegerField(default=3)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_company_profiles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'company_profile'


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"Notificacion para {self.user.username}: {self.message[:20]}"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Crear'
        UPDATE = 'UPDATE', 'Editar'
        DELETE = 'DELETE', 'Eliminar'
        STATUS_CHANGE = 'STATUS_CHANGE', 'Cambio de estado'
        APPROVAL = 'APPROVAL', 'Aprobacion'
        PAYMENT = 'PAYMENT', 'Pago'
        SYSTEM = 'SYSTEM', 'Sistema'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    module = models.CharField(max_length=80)
    model_name = models.CharField(max_length=100, blank=True, default='')
    object_id = models.CharField(max_length=100, blank=True, default='')
    object_repr = models.CharField(max_length=255, blank=True, default='')
    before_data = models.JSONField(null=True, blank=True)
    after_data = models.JSONField(null=True, blank=True)
    extra = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['module']),
            models.Index(fields=['model_name']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.module}:{self.action} {self.object_repr or self.object_id}"
