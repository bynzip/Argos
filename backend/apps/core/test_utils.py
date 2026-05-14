from apps.users.models import Permission, Role, User, UserRole


def ensure_permissions(codes):
    permissions = []
    for code in codes:
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={
                'name': code,
                'module': code.split('.')[0]
            }
        )
        permissions.append(permission)
    return permissions


def create_role_with_permissions(role_name, permission_codes):
    role, _ = Role.objects.get_or_create(nombre=role_name)
    permissions = ensure_permissions(permission_codes)
    for permission in permissions:
        role.role_permissions.get_or_create(permission=permission)
    return role


def create_user_with_role(username, role_name, permission_codes, **extra_fields):
    role = create_role_with_permissions(role_name, permission_codes)
    user = User.objects.create_user(
        username=username,
        email=extra_fields.pop('email', f'{username}@test.com'),
        password=extra_fields.pop('password', 'password123'),
        nombre=extra_fields.pop('nombre', username.title()),
        **extra_fields
    )
    UserRole.objects.get_or_create(user=user, role=role)
    return user
