from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_utils import create_user_with_role


class HrAttendanceTests(APITestCase):
    def setUp(self):
        self.user = create_user_with_role('tech_hr', 'Técnico', ['hr.mark_attendance', 'hr.view_own_attendance'])
        self.client.force_authenticate(self.user)

    def test_user_can_mark_entry_and_exit(self):
        entry = self.client.post('/api/hr/attendance/mark_entry/')
        self.assertEqual(entry.status_code, status.HTTP_200_OK)

        exit_response = self.client.post('/api/hr/attendance/mark_exit/')
        self.assertEqual(exit_response.status_code, status.HTTP_200_OK)
