from django.conf import settings
from django.db import models
from django.utils import timezone


class WorkSchedule(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Activo'
        INACTIVE = 'INACTIVE', 'Inactivo'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='work_schedules')
    nombre = models.CharField(max_length=120)
    estado = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    tardanza_tolerancia_min = models.IntegerField(default=5)
    descanso_maximo_min = models.IntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'work_schedules'
        ordering = ['user__nombre', 'nombre']


class WorkScheduleItem(models.Model):
    work_schedule = models.ForeignKey(WorkSchedule, on_delete=models.CASCADE, related_name='items')
    day_of_week = models.IntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_day_off = models.BooleanField(default=False)

    class Meta:
        db_table = 'work_schedule_items'


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'PRESENT', 'Presente'
        LATE = 'LATE', 'Tardanza'
        ABSENT = 'ABSENT', 'Ausente'
        JUSTIFIED = 'JUSTIFIED', 'Justificado'
        HOLIDAY = 'HOLIDAY', 'Feriado'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendances')
    work_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PRESENT)
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    total_break_minutes = models.IntegerField(default=0)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendances'
        unique_together = ('user', 'work_date')
        ordering = ['-work_date', '-created_at']


class AttendanceBreak(models.Model):
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='breaks')
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_breaks'


class AttendanceCorrection(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pendiente'
        APPROVED = 'APPROVED', 'Aprobado'
        REJECTED = 'REJECTED', 'Rechazado'

    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='corrections')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendance_corrections_requested')
    motivo = models.TextField()
    proposed_clock_in = models.DateTimeField(null=True, blank=True)
    proposed_clock_out = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_corrections_decided')
    decided_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_corrections'


class AttendanceAudit(models.Model):
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, related_name='audits')
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    field_name = models.CharField(max_length=50)
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    motivo = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_audits'


class Observation(models.Model):
    class Type(models.TextChoices):
        NOTE = 'NOTE', 'Nota'
        WARNING = 'WARNING', 'Advertencia'
        POSITIVE = 'POSITIVE', 'Positiva'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='observations')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_observations')
    observation_type = models.CharField(max_length=20, choices=Type.choices, default=Type.NOTE)
    mensaje = models.TextField()
    observation_date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'observations'
