from django.db import models
from django.utils import timezone
from django.conf import settings

class FolioCounter(models.Model):
    document_type = models.CharField(max_length=10, default='TKT')
    year = models.IntegerField(default=2024)
    last_number = models.IntegerField(default=0)

    class Meta:
        db_table = 'folio_counters'
        unique_together = ['document_type', 'year']

    @classmethod
    def get_next_folio(cls, document_type):
        from django.db import transaction
        year = timezone.now().year
        with transaction.atomic():
            counter, created = cls.objects.select_for_update().get_or_create(
                document_type=document_type,
                year=year,
                defaults={'last_number': 0}
            )
            counter.last_number += 1
            counter.save(update_fields=['last_number'])
            return f"{document_type}-{year}-{str(counter.last_number).zfill(4)}"

class CompanyProfile(models.Model):
    business_name = models.CharField(max_length=100)
    ruc = models.CharField(max_length=15)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
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
        return f"Notificación para {self.user.username}: {self.message[:20]}"
