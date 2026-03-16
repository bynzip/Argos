from rest_framework import serializers
from .models import User
from apps.core.models import SubArea

class UserSerializer(serializers.ModelSerializer):
    subarea_name = serializers.ReadOnlyField(source='subarea.name')
    area_name = serializers.ReadOnlyField(source='subarea.area.name')

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name', 'email', 
            'subarea', 'subarea_name', 'area_name', 'active_tickets_count',
            'is_staff', 'is_active', 'date_joined'
        )
        read_only_fields = ('id', 'date_joined', 'active_tickets_count')

class UserSimpleSerializer(serializers.ModelSerializer):
    """Simple serializer for selection lists"""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'full_name', 'username')

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
