from rest_framework import permissions
from apps.users.models import UserPermission, RolePermission as RolePerm

class RolePermission(permissions.BasePermission):
    """
    Permiso personalizado que verifica si el usuario tiene un permiso específico
    (ej: 'tickets.create') a través de sus roles o permisos directos.
    Para usarlo, la vista debe definir un atributo `required_permissions` (un diccionario o lista).
    Por simplicidad en el MVP, verificaremos si el usuario tiene el permiso de lectura o escritura
    dependiendo de la acción.
    """

    def has_permission(self, request, view):
        # Superusers can do anything
        if request.user and request.user.is_superuser:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        # Obtenemos los permisos requeridos de la vista (si están definidos)
        required_perms = getattr(view, 'required_permissions', None)
        if not required_perms:
            # Si la vista no define requerimientos, solo requiere IsAuthenticated
            return True

        # Determinar el permiso necesario para la acción actual
        action = getattr(view, 'action', None)
        if not action:
            return True

        # required_perms debe ser un dict que mapee acciones a permisos
        # ej: {'create': ['tickets.create'], 'list': ['tickets.view_list', 'tickets.view_own']}
        required_for_action = required_perms.get(action, [])
        if not required_for_action:
            return True

        # Obtener los permisos del usuario (esto ya lo hicimos en el serializer, podemos reusar la lógica)
        user_perms = set()
        for user_role in request.user.user_roles.select_related('role'):
            for role_perm in user_role.role.role_permissions.select_related('permission'):
                user_perms.add(role_perm.permission.code)
                
        for user_perm in request.user.user_permissions.select_related('permission'):
            if user_perm.is_denied:
                user_perms.discard(user_perm.permission.code)
            else:
                user_perms.add(user_perm.permission.code)

        # Chequear si el usuario tiene al menos UNO de los permisos requeridos para la acción
        # O si requiere TODOS, dependiendo de la política (vamos a requerir al menos uno por simplicidad)
        for req_perm in required_for_action:
            if req_perm in user_perms:
                return True

        return False

    def has_object_permission(self, request, view, obj):
        # Primero pasa por has_permission
        if not self.has_permission(request, view):
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, 'action', None)
        # Lógica específica por modelo
        if view.basename == 'ticket':
            # Ejemplo: tickets.view_own restringe la vista a sus propios tickets
            user_perms = self._get_user_perms(request.user)
            if 'tickets.view_own' in user_perms and 'tickets.view_list' not in user_perms:
                if action in ['retrieve', 'update', 'partial_update', 'transition', 'update_amounts']:
                    return obj.assigned_to == request.user or obj.created_by == request.user

        return True

    def _get_user_perms(self, user):
        perms = set()
        for user_role in user.user_roles.select_related('role'):
            for role_perm in user_role.role.role_permissions.select_related('permission'):
                perms.add(role_perm.permission.code)
        for user_perm in user.user_permissions.select_related('permission'):
            if user_perm.is_denied:
                perms.discard(user_perm.permission.code)
            else:
                perms.add(user_perm.permission.code)
        return perms