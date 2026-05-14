from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class RolePermission(permissions.BasePermission):
    """
    Verifica permisos declarados por acción en la vista.
    """

    def has_permission(self, request, view):
        if request.user and request.user.is_superuser:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        required_perms = getattr(view, 'required_permissions', None)
        if not required_perms:
            return True

        action = getattr(view, 'action', None)
        if not action:
            return True

        required_for_action = required_perms.get(action, [])
        if not required_for_action:
            return True

        user_perms = request.user.get_permission_codes()
        return any(req_perm in user_perms for req_perm in required_for_action)

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, 'action', None)
        if view.basename == 'ticket':
            user_perms = request.user.get_permission_codes()
            if 'tickets.view_own' in user_perms and 'tickets.view_list' not in user_perms:
                if action in ['retrieve', 'update', 'partial_update', 'transition', 'update_amounts']:
                    return obj.assigned_to == request.user or obj.created_by == request.user

        return True


def require_permission(user, permission_code, message=None):
    if user.is_superuser:
        return
    if not user.has_permission_code(permission_code):
        raise PermissionDenied(message or "No tienes permisos para realizar esta acción.")
