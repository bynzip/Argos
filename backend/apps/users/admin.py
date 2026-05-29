from django import forms
from django.contrib import admin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from .models import Area, Permission, Role, RolePermission, Subarea, User, UserPermission, UserRole


def set_admin_names(model, singular, plural):
    model._meta.verbose_name = singular
    model._meta.verbose_name_plural = plural


set_admin_names(User, 'Usuario', 'Usuarios')
set_admin_names(Area, 'Area', 'Areas')
set_admin_names(Subarea, 'Subarea', 'Subareas')
set_admin_names(Role, 'Rol', 'Roles')
set_admin_names(Permission, 'Permiso', 'Permisos')
set_admin_names(UserRole, 'Rol de usuario', 'Roles de usuario')
set_admin_names(RolePermission, 'Permiso de rol', 'Permisos de rol')
set_admin_names(UserPermission, 'Permiso de usuario', 'Permisos de usuario')


class UserAdminCreationForm(forms.ModelForm):
    password1 = forms.CharField(label='Contrasena', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirmar contrasena', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('username', 'email', 'nombre', 'subarea', 'is_active', 'is_superuser')

    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError('Las contrasenas no coinciden.')
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class UserAdminChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(label='Contrasena')

    class Meta:
        model = User
        fields = '__all__'


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 0
    autocomplete_fields = ('role',)
    readonly_fields = ('assigned_at',)
    verbose_name = 'Rol asignado'
    verbose_name_plural = 'Roles asignados'


class UserPermissionInline(admin.TabularInline):
    model = UserPermission
    extra = 0
    autocomplete_fields = ('permission',)
    verbose_name = 'Permiso directo'
    verbose_name_plural = 'Permisos directos'


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0
    autocomplete_fields = ('permission',)
    verbose_name = 'Permiso incluido'
    verbose_name_plural = 'Permisos incluidos'


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    form = UserAdminChangeForm
    add_form = UserAdminCreationForm
    list_display = ('username', 'nombre', 'email', 'subarea', 'is_active', 'is_superuser', 'active_ticket_count')
    list_filter = ('is_active', 'is_superuser', 'subarea__area', 'subarea')
    search_fields = ('username', 'email', 'nombre')
    ordering = ('username',)
    readonly_fields = ('password', 'active_ticket_count', 'created_at', 'updated_at', 'deleted_at')
    inlines = (UserRoleInline, UserPermissionInline)

    fieldsets = (
        ('Cuenta', {'fields': ('username', 'password', 'email', 'nombre')}),
        ('Organizacion', {'fields': ('subarea',)}),
        ('Acceso', {'fields': ('is_active', 'is_superuser')}),
        ('Sistema', {'fields': ('active_ticket_count', 'created_at', 'updated_at', 'deleted_at')}),
    )
    add_fieldsets = (
        ('Nuevo usuario', {
            'fields': ('username', 'email', 'nombre', 'password1', 'password2', 'subarea', 'is_active', 'is_superuser'),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        kwargs['form'] = self.add_form if obj is None else self.form
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        return self.add_fieldsets if obj is None else self.fieldsets

    def get_inline_instances(self, request, obj=None):
        if obj is None:
            return []
        return super().get_inline_instances(request, obj)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion', 'created_at')
    search_fields = ('nombre', 'descripcion')
    readonly_fields = ('created_at', 'updated_at')
    inlines = (RolePermissionInline,)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'module', 'is_active')
    list_filter = ('module', 'is_active')
    search_fields = ('code', 'name', 'module')
    readonly_fields = ('created_at',)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'created_at')
    list_filter = ('activo',)
    search_fields = ('nombre', 'descripcion')
    readonly_fields = ('created_at',)


@admin.register(Subarea)
class SubareaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'area', 'activo', 'created_at')
    list_filter = ('area', 'activo')
    search_fields = ('nombre', 'descripcion', 'area__nombre')
    autocomplete_fields = ('area',)
    readonly_fields = ('created_at',)
