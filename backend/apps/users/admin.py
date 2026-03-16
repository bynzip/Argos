from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'subarea', 'active_tickets_count', 'is_staff')
    list_filter = ('subarea', 'is_staff', 'is_superuser', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('Información de Argos', {'fields': ('subarea', 'active_tickets_count')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Información de Argos', {'fields': ('first_name', 'last_name', 'email', 'subarea')}),
    )
