from django.contrib import admin
from .models import User, Area, Subarea, Role, Permission

@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'nombre', 'is_active', 'subarea', 'active_ticket_count')
    list_filter = ('is_active', 'is_superuser')
    search_fields = ('username', 'email', 'nombre')

admin.site.register(Area)
admin.site.register(Subarea)
admin.site.register(Role)
admin.site.register(Permission)
