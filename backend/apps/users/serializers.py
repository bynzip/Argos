from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Role, Permission

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'nombre', 'is_active', 'subarea', 'active_ticket_count', 'role', 'permissions')
        
    def get_role(self, obj):
        # Tomar el primer rol para simplificar el MVP, aunque el modelo soporta varios
        user_role = obj.user_roles.first()
        return user_role.role.nombre if user_role else None

    def get_permissions(self, obj):
        # Si es superusuario, no necesita la lista explícita, pero podemos enviarla
        if obj.is_superuser:
            return ["all"]
            
        perms = set()
        # Obtener permisos de los roles
        for user_role in obj.user_roles.select_related('role'):
            for role_perm in user_role.role.role_permissions.select_related('permission'):
                perms.add(role_perm.permission.code)
                
        # Obtener permisos directos del usuario (incluyendo los denegados)
        for user_perm in obj.user_permissions.select_related('permission'):
            if user_perm.is_denied:
                perms.discard(user_perm.permission.code)
            else:
                perms.add(user_perm.permission.code)
                
        return list(perms)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Agregar datos del usuario al token
        user_data = UserSerializer(self.user).data
        data['user'] = user_data
        
        return data
