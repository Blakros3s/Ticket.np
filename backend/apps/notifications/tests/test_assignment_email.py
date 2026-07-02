from django.core import mail
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.users.models import User


class TicketAssignmentEmailTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.assigner = User.objects.create_user(
            username='assigner',
            email='assigner@test.com',
            password='assignerpass123',
            role='employee',
        )
        self.assignee = User.objects.create_user(
            username='assignee',
            email='assignee@test.com',
            password='assigneepass123',
            role='employee',
        )
        self.other_member = User.objects.create_user(
            username='other',
            email='other@test.com',
            password='otherpass123',
            role='employee',
        )

        self.project = Project.objects.create(
            name='Email Test Project',
            description='Project for assignment email tests',
            created_by=self.assigner,
            status='active',
        )
        self.project.members.add(self.assigner, self.assignee, self.other_member)

        self.ticket = Ticket.objects.create(
            title='Email Test Ticket',
            description='Assignment email coverage',
            type='task',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.assigner,
        )

    def test_create_ticket_sends_assignment_email(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            '/api/tickets/tickets/',
            {
                'title': 'Created With Assignee',
                'description': 'Notify assignee on create',
                'type': 'bug',
                'priority': 'medium',
                'project': self.project.id,
                'assignees': [self.assignee.id],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        ticket = Ticket.objects.get(id=response.data['id'])
        self.assertEqual(Notification.objects.filter(user=self.assignee, ticket_id=ticket.id).count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.assignee.email])
        self.assertEqual(
            mail.outbox[0].subject,
            f'assigner assigned you to {ticket.ticket_id}',
        )
        self.assertIn(ticket.ticket_id, mail.outbox[0].body)
        self.assertIn(
            f'/protected/dashboard/tickets/{ticket.id}',
            mail.outbox[0].alternatives[0][0],
        )
        self.assertEqual(mail.outbox[0].content_subtype, 'plain')
        self.assertEqual(len(mail.outbox[0].alternatives), 1)

    @override_settings(
        FRONTEND_URL='http://localhost:3000',
        WEBSITE_URL='https://technestinnovations.com.np',
    )
    def test_create_ticket_email_uses_website_url_in_dev(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            '/api/tickets/tickets/',
            {
                'title': 'Dev Environment Ticket',
                'description': 'Use public website link in email body',
                'type': 'bug',
                'priority': 'medium',
                'project': self.project.id,
                'assignees': [self.assignee.id],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn('localhost', mail.outbox[0].body.lower())
        self.assertIn('technestinnovations.com.np', mail.outbox[0].body)
        self.assertIn("Sign in to TicketHub when you're ready", mail.outbox[0].body)

    def test_patch_adds_assignee_email(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.patch(
            f'/api/tickets/tickets/{self.ticket.id}/',
            {'assignees': [self.assignee.id]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.assignee, ticket_id=self.ticket.id).count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.assignee.email])

    def test_assign_ticket_endpoint_sends_email(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            f'/api/tickets/tickets/{self.ticket.id}/assign_ticket/',
            {'user_id': self.assignee.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.assignee, ticket_id=self.ticket.id).count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(EMAIL_ENABLED=False)
    def test_no_email_when_email_disabled(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            f'/api/tickets/tickets/{self.ticket.id}/assign_ticket/',
            {'user_id': self.assignee.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.assignee, ticket_id=self.ticket.id).count(), 1)
        self.assertEqual(len(mail.outbox), 0)

    def test_self_assign_sends_no_email(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assignee)
        response = self.client.post(
            f'/api/tickets/tickets/{self.ticket.id}/self_assign/',
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Notification.objects.filter(user=self.assignee, ticket_id=self.ticket.id).exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_duplicate_assign_sends_no_second_email(self):
        self.ticket.assignees.add(self.assignee)
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            f'/api/tickets/tickets/{self.ticket.id}/assign_ticket/',
            {'user_id': self.assignee.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.assignee, ticket_id=self.ticket.id).count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_self_assign_on_create_sends_no_email(self):
        mail.outbox.clear()
        self.client.force_authenticate(user=self.assigner)
        response = self.client.post(
            '/api/tickets/tickets/',
            {
                'title': 'Self Assigned Ticket',
                'description': 'Creator assigns self',
                'type': 'task',
                'priority': 'low',
                'project': self.project.id,
                'assignees': [self.assigner.id],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket_id = response.data['id']
        self.assertFalse(Notification.objects.filter(user=self.assigner, ticket_id=ticket_id).exists())
        self.assertEqual(len(mail.outbox), 0)
