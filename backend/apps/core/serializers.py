from rest_framework import serializers
from .models import Area, SubArea, CompanyProfile

class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = '__all__'

class SubAreaSerializer(serializers.ModelSerializer):
    area_name = serializers.ReadOnlyField(source='area.name')

    class Meta:
        model = SubArea
        fields = '__all__'

class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
