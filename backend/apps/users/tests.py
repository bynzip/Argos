from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role


class UserPermissionsTests(APITestCase):
    def setUp(self):
        self.admin = create_user_with_role(
            'admin',
            'Administrador',
            ['users.view_list', 'users.create', 'users.edit', 'users.suspend']
        )
        self.receptionist = create_user_with_role(
            'recep',
            'Recepcionista',
            ['customers.view_list']
        )

    def test_admin_can_list_users(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_admin_cannot_list_users(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_escalate_permissions(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post('/api/users/', {
            'username': 'hacker',
            'email': 'hacker@test.com',
            'nombre': 'Hacker',
            'password': 'password123',
            'is_superuser': True,
            'role_name': 'Administrador',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
