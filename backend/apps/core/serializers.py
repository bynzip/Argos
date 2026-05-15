from rest_framework import serializers

from apps.users.serializers import UserSerializer

from .models import AuditLog, CompanyProfile, Notification


class CompanyProfileSerializer(serializers.ModelSerializer):
    updated_by = UserSerializer(read_only=True)

    class Meta:
        model = CompanyProfile
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'updated_by')


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'is_read', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'action',
            'module',
            'model_name',
            'object_id',
            'object_repr',
            'before_data',
            'after_data',
            'extra',
            'created_at',
        ]
