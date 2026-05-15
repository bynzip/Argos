from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import User
from apps.users.permissions import RolePermission

from .models import Attendance, AttendanceCorrection, Observation, WorkSchedule
from .serializers import AttendanceCorrectionSerializer, AttendanceSerializer, ObservationSerializer, WorkScheduleSerializer
from .services import decide_correction, end_break, mark_entry, mark_exit, request_correction, start_break


class WorkScheduleViewSet(viewsets.ModelViewSet):
    queryset = WorkSchedule.objects.select_related('user').prefetch_related('items')
    serializer_class = WorkScheduleSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['hr.manage_schedules'],
        'retrieve': ['hr.manage_schedules'],
        'create': ['hr.manage_schedules'],
        'update': ['hr.manage_schedules'],
        'partial_update': ['hr.manage_schedules'],
        'destroy': ['hr.manage_schedules'],
    }


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Attendance.objects.select_related('user').prefetch_related('breaks', 'corrections')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['hr.view_own_attendance', 'hr.view_all_attendance'],
        'retrieve': ['hr.view_own_attendance', 'hr.view_all_attendance'],
        'mark_entry': ['hr.mark_attendance'],
        'start_break': ['hr.mark_attendance'],
        'end_break': ['hr.mark_attendance'],
        'mark_exit': ['hr.mark_attendance'],
        'request_correction': ['hr.mark_attendance'],
    }

    def get_queryset(self):
        qs = super().get_queryset().order_by('-work_date')
        if self.request.user.is_superuser or self.request.user.has_permission_code('hr.view_all_attendance'):
            return qs
        return qs.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_entry(self, request):
        attendance = mark_entry(request.user)
        return Response(self.get_serializer(attendance).data)

    @action(detail=False, methods=['post'])
    def start_break(self, request):
        attendance = start_break(request.user)
        return Response(self.get_serializer(attendance).data)

    @action(detail=False, methods=['post'])
    def end_break(self, request):
        attendance = end_break(request.user)
        return Response(self.get_serializer(attendance).data)

    @action(detail=False, methods=['post'])
    def mark_exit(self, request):
        attendance = mark_exit(request.user)
        return Response(self.get_serializer(attendance).data)

    @action(detail=True, methods=['post'])
    def request_correction(self, request, pk=None):
        correction = request_correction(
            attendance=self.get_object(),
            user=request.user,
            motivo=request.data.get('motivo', ''),
            proposed_clock_in=request.data.get('proposed_clock_in'),
            proposed_clock_out=request.data.get('proposed_clock_out'),
        )
        return Response(AttendanceCorrectionSerializer(correction).data, status=status.HTTP_201_CREATED)


class AttendanceCorrectionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AttendanceCorrection.objects.select_related('attendance', 'requested_by', 'decided_by')
    serializer_class = AttendanceCorrectionSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['hr.approve_corrections'],
        'retrieve': ['hr.approve_corrections'],
        'approve': ['hr.approve_corrections'],
        'reject': ['hr.approve_corrections'],
    }

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        correction = decide_correction(correction=self.get_object(), user=request.user, approve=True, admin_notes=request.data.get('admin_notes', ''))
        return Response(self.get_serializer(correction).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        correction = decide_correction(correction=self.get_object(), user=request.user, approve=False, admin_notes=request.data.get('admin_notes', ''))
        return Response(self.get_serializer(correction).data)


class ObservationViewSet(viewsets.ModelViewSet):
    queryset = Observation.objects.select_related('user', 'created_by')
    serializer_class = ObservationSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['hr.manage_observations'],
        'retrieve': ['hr.manage_observations'],
        'create': ['hr.manage_observations'],
        'update': ['hr.manage_observations'],
        'partial_update': ['hr.manage_observations'],
        'destroy': ['hr.manage_observations'],
    }

    def perform_create(self, serializer):
        target_user = User.objects.get(pk=self.request.data.get('user'))
        serializer.save(user=target_user, created_by=self.request.user, observation_date=timezone.localdate())
