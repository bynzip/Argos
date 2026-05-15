from .models import AuditLog


def log_audit(
    *,
    module,
    action,
    user=None,
    obj=None,
    before_data=None,
    after_data=None,
    extra=None,
):
    AuditLog.objects.create(
        user=user,
        module=module,
        action=action,
        model_name=obj.__class__.__name__ if obj else '',
        object_id=str(getattr(obj, 'pk', '') or ''),
        object_repr=str(obj) if obj else '',
        before_data=before_data,
        after_data=after_data,
        extra=extra,
    )
