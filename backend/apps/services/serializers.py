from rest_framework import serializers

from apps.core.utils import generate_folio

from .models import Service, ServiceCategory, TicketService


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = '__all__'


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.nombre')

    class Meta:
        model = Service
        fields = (
            'id', 'codigo', 'category', 'category_name', 'nombre', 'descripcion',
            'precio_base', 'horas_estimadas', 'activo', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'codigo', 'created_at', 'updated_at')

    def create(self, validated_data):
        validated_data['codigo'] = generate_folio('SRV')
        return super().create(validated_data)


class TicketServiceSerializer(serializers.ModelSerializer):
    service_name = serializers.ReadOnlyField(source='service.nombre')

    class Meta:
        model = TicketService
        fields = ('id', 'ticket', 'service', 'service_name', 'precio_aplicado', 'notas', 'aplicado_por', 'created_at')
        read_only_fields = ('id', 'aplicado_por', 'created_at')

