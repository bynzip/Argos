from rest_framework import serializers

from apps.users.serializers import UserSerializer

from .models import Attendance, AttendanceBreak, AttendanceCorrection, Observation, WorkSchedule, WorkScheduleItem


class WorkScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkScheduleItem
        fields = '__all__'


class WorkScheduleSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.nombre')
    items = WorkScheduleItemSerializer(many=True, read_only=True)

    class Meta:
        model = WorkSchedule
        fields = '__all__'


class AttendanceBreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceBreak
        fields = '__all__'


class AttendanceSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    breaks = AttendanceBreakSerializer(many=True, read_only=True)

    class Meta:
        model = Attendance
        fields = '__all__'


class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    requested_by = UserSerializer(read_only=True)
    decided_by = UserSerializer(read_only=True)

    class Meta:
        model = AttendanceCorrection
        fields = '__all__'


class ObservationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Observation
        fields = '__all__'
