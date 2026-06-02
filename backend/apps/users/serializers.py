from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role, User, UserRole


class UserReadSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'nombre', 'is_active', 'subarea',
            'active_ticket_count', 'role', 'roles', 'permissions', 'is_superuser'
        )

    def get_role(self, obj):
        user_role = obj.user_roles.first()
        return user_role.role.nombre if user_role else None

    def get_roles(self, obj):
        return list(obj.user_roles.select_related('role').values_list('role__nombre', flat=True))

    def get_permissions(self, obj):
        if obj.is_superuser:
            return ["all"]
        return sorted(obj.get_permission_codes())


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    role_name = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'nombre', 'password', 'subarea', 'is_active', 'role_name')
        read_only_fields = ('id',)

    def validate_role_name(self, value):
        if not Role.objects.filter(nombre=value).exists():
            raise serializers.ValidationError("El rol indicado no existe.")
        return value

    def create(self, validated_data):
        role_name = validated_data.pop('role_name', None)
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria.'})

        user = User.objects.create_user(password=password, **validated_data)
        if role_name:
            role = Role.objects.get(nombre=role_name)
            UserRole.objects.update_or_create(
                user=user,
                role=role,
                defaults={'assigned_by': self.context['request'].user}
            )
        return user

    def update(self, instance, validated_data):
        role_name = validated_data.pop('role_name', None)
        password = validated_data.pop('password', None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()

        if role_name:
            role = Role.objects.get(nombre=role_name)
            instance.user_roles.exclude(role=role).delete()
            UserRole.objects.update_or_create(
                user=instance,
                role=role,
                defaults={'assigned_by': self.context['request'].user}
            )

        return instance


UserSerializer = UserReadSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserReadSerializer(self.user).data
        return data
