from rest_framework import serializers
from .models import Customer, Device

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ('id', 'customer', 'tipo_equipo', 'marca', 'modelo', 'numero_serie', 'notas', 'is_active', 'created_at')
        read_only_fields = ('id', 'customer', 'created_at')

class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer ligero para la tabla de clientes (no carga dispositivos ni historiales complejos)."""
    class Meta:
        model = Customer
        fields = (
            'id', 'tipo_cliente', 'identificador', 'nombre', 
            'telefono', 'correo_electronico', 'etiqueta', 'is_active'
        )

class CustomerDetailSerializer(serializers.ModelSerializer):
    """Serializer pesado para el detalle del cliente (incluye dispositivos y futuro historial)."""
    devices = DeviceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Customer
        fields = (
            'id', 'tipo_cliente', 'identificador', 'nombre', 
            'telefono', 'correo_electronico', 'direccion', 
            'etiqueta', 'etiqueta_anterior', 'veces_moroso', 
            'notas', 'is_active', 'devices', 'created_at'
        )
        read_only_fields = ('id', 'veces_moroso', 'etiqueta_anterior', 'created_at')
        
    def validate_identificador(self, value):
        """Valida unicidad del identificador excluyendo los registros con soft delete (manejado parcialmente por el UniqueConstraint de BD, pero se agrega a nivel serializer para dar un mensaje más amigable)."""
        request = self.context.get('request')
        query = Customer.objects.filter(identificador=value)
        
        # Si es un PATCH/PUT, ignorar al propio cliente
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
            
        if query.exists():
            raise serializers.ValidationError("Este DNI/RUC ya se encuentra registrado en un cliente activo.")
        return value
