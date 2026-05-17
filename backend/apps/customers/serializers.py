from rest_framework import serializers
from django.db import IntegrityError
from .models import Customer, Device
# Removed TicketListSerializer import here to avoid circular imports

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
    tickets = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = (
            'id', 'tipo_cliente', 'identificador', 'nombre', 
            'telefono', 'correo_electronico', 'direccion', 
            'etiqueta', 'etiqueta_anterior', 'veces_moroso', 
            'notas', 'is_active', 'devices', 'tickets', 'created_at'
        )
        read_only_fields = ('id', 'veces_moroso', 'etiqueta_anterior', 'created_at')
        
    def get_tickets(self, obj):
        from apps.tickets.serializers import TicketListSerializer
        tickets = obj.tickets.select_related('customer', 'device', 'assigned_to').order_by('-created_at')
        return TicketListSerializer(tickets, many=True).data
        
    def validate(self, attrs):
        tipo_cliente = attrs.get('tipo_cliente') or getattr(self.instance, 'tipo_cliente', None)
        identificador = (
            attrs.get('identificador')
            or getattr(self.instance, 'identificador', '')
        ).strip()

        if tipo_cliente not in {'PERSONA', 'EMPRESA'}:
            raise serializers.ValidationError({'tipo_cliente': 'Debes seleccionar un tipo de cliente válido.'})

        if not identificador.isdigit():
            raise serializers.ValidationError({
                'identificador': 'El identificador solo debe contener dígitos numéricos.'
            })

        expected_length = 8 if tipo_cliente == 'PERSONA' else 11
        document_name = 'DNI' if tipo_cliente == 'PERSONA' else 'RUC'
        if len(identificador) != expected_length:
            raise serializers.ValidationError({
                'identificador': f'El {document_name} debe tener exactamente {expected_length} dígitos.'
            })

        query = Customer.objects.filter(
            tipo_cliente=tipo_cliente,
            identificador=identificador,
        )
        if self.instance:
            query = query.exclude(pk=self.instance.pk)

        if query.exists():
            raise serializers.ValidationError({
                'identificador': f'Este {document_name} ya se encuentra registrado en un cliente activo.'
            })

        attrs['identificador'] = identificador
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError:
            doc = 'DNI' if validated_data.get('tipo_cliente') == 'PERSONA' else 'RUC'
            raise serializers.ValidationError({
                'identificador': f'Este {doc} ya se encuentra registrado en un cliente activo.'
            })
