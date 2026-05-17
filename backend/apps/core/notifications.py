from django.db.models import Q

from apps.core.models import Notification
from apps.users.models import User


def create_role_notifications(*, role_names, message, include_superusers=False):
    if isinstance(role_names, str):
        role_names = [role_names]

    filters = Q(user_roles__role__nombre__in=role_names)
    if include_superusers:
        filters |= Q(is_superuser=True)

    recipients = User.objects.filter(
        filters,
        deleted_at__isnull=True,
        is_active=True,
    ).distinct()

    Notification.objects.bulk_create(
        [Notification(user=user, message=message) for user in recipients]
    )
    return recipients.count()
