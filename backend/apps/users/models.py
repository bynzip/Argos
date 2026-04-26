from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone
from apps.customers.models import SoftDeleteManager, AllObjectsManager

class Area(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'areas'

    def __str__(self):
        return self.nombre


class Subarea(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='subareas')
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subareas'

    def __str__(self):
        return f"{self.area.nombre} - {self.nombre}"


class Role(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'roles'

    def __str__(self):
        return self.nombre


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=60)
    descripcion = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'permissions'
        indexes = [
            models.Index(fields=['module']),
        ]

    def __str__(self):
        return self.name


class UserManager(BaseUserManager, SoftDeleteManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError("El email es obligatorio")
        if not username:
            raise ValueError("El username es obligatorio")
        
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, username, password, **extra_fields)


class User(AbstractBaseUser):
    nombre = models.CharField(max_length=150)
    email = models.EmailField(max_length=254, unique=True)
    username = models.CharField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    
    subarea = models.ForeignKey(Subarea, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    active_ticket_count = models.IntegerField(default=0)
    
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    all_objects = AllObjectsManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'nombre']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['deleted_at', 'is_active'])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        self.is_active = True
        self.save(update_fields=['deleted_at', 'is_active'])

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser
        
    def get_all_permissions(self, obj=None):
        if self.is_superuser:
            return set() # Django admin usa has_perm directamente para superusuarios
        return set()
        
    @property
    def is_staff(self):
        return self.is_superuser


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_users')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_roles')

    class Meta:
        db_table = 'user_roles'
        unique_together = ('user', 'role')


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_roles')

    class Meta:
        db_table = 'role_permissions'
        unique_together = ('role', 'permission')


class UserPermission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_users')
    is_denied = models.BooleanField(default=False)

    class Meta:
        db_table = 'user_permissions'
        unique_together = ('user', 'permission')
