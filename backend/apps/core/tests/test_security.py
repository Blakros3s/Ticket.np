from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket


class AuthorizationSecurityTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            username='sec_admin',
            email='sec_admin@test.com',
            password='pass12345',
            role='admin',
        )
        self.manager = User.objects.create_user(
            username='sec_manager',
            email='sec_manager@test.com',
            password='pass12345',
            role='manager',
        )
        self.member = User.objects.create_user(
            username='sec_member',
            email='sec_member@test.com',
            password='pass12345',
            role='employee',
        )
        self.outsider = User.objects.create_user(
            username='sec_outsider',
            email='sec_outsider@test.com',
            password='pass12345',
            role='employee',
        )

        self.project = Project.objects.create(
            name='Security Project',
            description='Security test project',
            created_by=self.manager,
            status='active',
        )
        self.project.members.add(self.manager, self.member)

        self.ticket = Ticket.objects.create(
            title='Security Ticket',
            description='Security test ticket',
            type='task',
            priority='medium',
            status='new',
            project=self.project,
            created_by=self.member,
        )

    def test_profile_cannot_escalate_role(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            '/api/auth/profile/',
            {'role': 'admin'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, 'employee')

    def test_non_admin_cannot_create_users(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            '/api/auth/users/',
            {
                'username': 'hacker_admin',
                'email': 'hacker@test.com',
                'password': 'pass12345',
                'confirm_password': 'pass12345',
                'role': 'admin',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_create_ticket_on_foreign_project(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            '/api/tickets/tickets/',
            {
                'title': 'Unauthorized',
                'description': 'Should fail',
                'type': 'bug',
                'priority': 'low',
                'project': self.project.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_comment_on_foreign_ticket(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            '/api/comments/',
            {'ticket': self.ticket.id, 'content': 'Unauthorized comment'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_start_work_on_foreign_ticket(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            '/api/timelogs/worklogs/start_work/',
            {'ticket_id': self.ticket.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_outsider_cannot_list_foreign_project_documents(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/projects/projects/{self.project.id}/documents/')
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_employee_cannot_access_manager_dashboard(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get('/api/dashboard/manager/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_cannot_access_team_attendance(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get('/api/attendance/attendance/team/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
