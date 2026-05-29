from django.contrib import admin

from .models import Observation


Observation._meta.verbose_name = 'Observacion administrativa'
Observation._meta.verbose_name_plural = 'Observaciones administrativas'


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ('user', 'observation_type', 'observation_date', 'created_by', 'created_at')
    list_filter = ('observation_type', 'observation_date')
    search_fields = ('user__nombre', 'user__username', 'created_by__nombre', 'mensaje')
    autocomplete_fields = ('user', 'created_by')
    readonly_fields = ('created_at',)

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
