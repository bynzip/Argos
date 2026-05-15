from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.audit import log_audit

from .models import Attendance, AttendanceAudit, AttendanceBreak, AttendanceCorrection


def get_or_create_today_attendance(user):
    attendance, _ = Attendance.objects.get_or_create(
        user=user,
        work_date=timezone.localdate(),
        defaults={'status': Attendance.Status.PRESENT},
    )
    return attendance


@transaction.atomic
def mark_entry(user):
    attendance = get_or_create_today_attendance(user)
    if attendance.clock_in:
        raise ValidationError({'detail': 'La entrada ya fue registrada.'})
    attendance.clock_in = timezone.now()
    attendance.save(update_fields=['clock_in', 'updated_at'])
    log_audit(module='hr', action='STATUS_CHANGE', user=user, obj=attendance, after_data={'clock_in': attendance.clock_in.isoformat()})
    return attendance


@transaction.atomic
def start_break(user):
    attendance = get_or_create_today_attendance(user)
    open_break = attendance.breaks.filter(ended_at__isnull=True).first()
    if open_break:
        raise ValidationError({'detail': 'Ya existe un descanso abierto.'})
    AttendanceBreak.objects.create(attendance=attendance, started_at=timezone.now())
    return attendance


@transaction.atomic
def end_break(user):
    attendance = get_or_create_today_attendance(user)
    open_break = attendance.breaks.filter(ended_at__isnull=True).order_by('-started_at').first()
    if not open_break:
        raise ValidationError({'detail': 'No hay descanso abierto.'})
    open_break.ended_at = timezone.now()
    open_break.save(update_fields=['ended_at'])
    attendance.total_break_minutes = sum(
        max(int((break_item.ended_at - break_item.started_at).total_seconds() / 60), 0)
        for break_item in attendance.breaks.filter(ended_at__isnull=False)
    )
    attendance.save(update_fields=['total_break_minutes', 'updated_at'])
    return attendance


@transaction.atomic
def mark_exit(user):
    attendance = get_or_create_today_attendance(user)
    if not attendance.clock_in:
        raise ValidationError({'detail': 'No puedes registrar salida sin entrada.'})
    attendance.clock_out = timezone.now()
    attendance.save(update_fields=['clock_out', 'updated_at'])
    return attendance


@transaction.atomic
def request_correction(*, attendance, user, motivo, proposed_clock_in=None, proposed_clock_out=None):
    correction = AttendanceCorrection.objects.create(
        attendance=attendance,
        requested_by=user,
        motivo=motivo,
        proposed_clock_in=proposed_clock_in,
        proposed_clock_out=proposed_clock_out,
    )
    log_audit(module='hr', action='CREATE', user=user, obj=correction, after_data={'estado': correction.estado})
    return correction


@transaction.atomic
def decide_correction(*, correction, user, approve, admin_notes=''):
    if correction.estado != AttendanceCorrection.Status.PENDING:
        raise ValidationError({'detail': 'La solicitud ya fue decidida.'})
    correction.estado = AttendanceCorrection.Status.APPROVED if approve else AttendanceCorrection.Status.REJECTED
    correction.decided_by = user
    correction.decided_at = timezone.now()
    correction.admin_notes = admin_notes or ''
    correction.save(update_fields=['estado', 'decided_by', 'decided_at', 'admin_notes'])
    if approve:
        attendance = correction.attendance
        if correction.proposed_clock_in:
            AttendanceAudit.objects.create(
                attendance=attendance,
                changed_by=user,
                field_name='clock_in',
                old_value=attendance.clock_in.isoformat() if attendance.clock_in else '',
                new_value=correction.proposed_clock_in.isoformat(),
                motivo=correction.motivo,
            )
            attendance.clock_in = correction.proposed_clock_in
        if correction.proposed_clock_out:
            AttendanceAudit.objects.create(
                attendance=attendance,
                changed_by=user,
                field_name='clock_out',
                old_value=attendance.clock_out.isoformat() if attendance.clock_out else '',
                new_value=correction.proposed_clock_out.isoformat(),
                motivo=correction.motivo,
            )
            attendance.clock_out = correction.proposed_clock_out
        attendance.save(update_fields=['clock_in', 'clock_out', 'updated_at'])
    return correction
