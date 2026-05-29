from django import forms
from django.contrib import admin
from django.contrib.admin.widgets import FilteredSelectMultiple
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


def build_roles_field():
    return forms.ModelMultipleChoiceField(
        label='Roles',
        queryset=Role.objects.none(),
        required=False,
        widget=FilteredSelectMultiple('roles', is_stacked=False),
        help_text='Selecciona uno o mas roles para este usuario.',
    )


class UserRolesFormMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['roles'].queryset = Role.objects.order_by('nombre')
        if self.instance and self.instance.pk:
            self.fields['roles'].initial = Role.objects.filter(role_users__user=self.instance)


class UserAdminCreationForm(UserRolesFormMixin, forms.ModelForm):
    roles = build_roles_field()
    password1 = forms.CharField(label='Contrasena', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirmar contrasena', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('username', 'email', 'nombre', 'is_active', 'is_superuser')

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


class UserAdminChangeForm(UserRolesFormMixin, forms.ModelForm):
    roles = build_roles_field()
    password = ReadOnlyPasswordHashField(label='Contrasena')

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'nombre', 'is_active', 'is_superuser')


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
    list_display = ('username', 'nombre', 'email', 'roles_display', 'is_active', 'is_superuser', 'active_ticket_count')
    list_filter = ('is_active', 'is_superuser', 'user_roles__role')
    search_fields = ('username', 'email', 'nombre')
    ordering = ('username',)
    readonly_fields = ('password', 'active_ticket_count', 'created_at', 'updated_at', 'deleted_at')

    fieldsets = (
        ('Cuenta', {'fields': ('username', 'password', 'email', 'nombre')}),
        ('Acceso y roles', {'fields': ('roles', 'is_active', 'is_superuser')}),
        ('Sistema', {'fields': ('active_ticket_count', 'created_at', 'updated_at', 'deleted_at')}),
    )
    add_fieldsets = (
        ('Nuevo usuario', {
            'fields': ('username', 'email', 'nombre', 'password1', 'password2', 'roles', 'is_active', 'is_superuser'),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        kwargs['form'] = self.add_form if obj is None else self.form
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        return self.add_fieldsets if obj is None else self.fieldsets

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        selected_roles = form.cleaned_data.get('roles')
        if selected_roles is not None:
            current_role_ids = set(obj.user_roles.values_list('role_id', flat=True))
            selected_role_ids = {role.id for role in selected_roles}
            obj.user_roles.filter(role_id__in=current_role_ids - selected_role_ids).delete()
            for role in selected_roles:
                UserRole.objects.get_or_create(
                    user=obj,
                    role=role,
                    defaults={'assigned_by': request.user if request.user.is_authenticated else None},
                )

    def roles_display(self, obj):
        roles = [user_role.role.nombre for user_role in obj.user_roles.select_related('role')]
        return ', '.join(roles) if roles else 'Sin rol'

    roles_display.short_description = 'Roles'


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
