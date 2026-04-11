from django.db import models

class FolioCounter(models.Model):
    prefix = models.CharField(max_length=10, unique=True)
    last_number = models.IntegerField(default=0)

    class Meta:
        db_table = 'folio_counters'

    @classmethod
    def get_next_folio(cls, prefix):
        from django.db import transaction
        with transaction.atomic():
            counter, created = cls.objects.select_for_update().get_or_create(prefix=prefix)
            counter.last_number += 1
            counter.save()
            return f"{prefix}-{str(counter.last_number).zfill(4)}"

# Re-añadimos los modelos completos para que coincidan con admin.py
class Area(models.Model):
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'core_areas'
    def __str__(self): return self.name

class SubArea(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    current_load = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'core_subareas'

class CompanyProfile(models.Model):
    business_name = models.CharField(max_length=100)
    ruc = models.CharField(max_length=15)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'company_profile'
