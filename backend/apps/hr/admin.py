from django.contrib import admin

from .models import Attendance, AttendanceAudit, AttendanceBreak, AttendanceCorrection, Observation, WorkSchedule, WorkScheduleItem


class WorkScheduleItemInline(admin.TabularInline):
    model = WorkScheduleItem
    extra = 0


@admin.register(WorkSchedule)
class WorkScheduleAdmin(admin.ModelAdmin):
    list_display = ('user', 'nombre', 'estado', 'tardanza_tolerancia_min', 'descanso_maximo_min')
    inlines = [WorkScheduleItemInline]


admin.site.register(Attendance)
admin.site.register(AttendanceBreak)
admin.site.register(AttendanceCorrection)
admin.site.register(AttendanceAudit)
admin.site.register(Observation)
