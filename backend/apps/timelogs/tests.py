from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.timelogs.models import WorkLog


class WorkLogAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='managerpass123',
            role='manager'
        )
        
        # Create project and ticket
        self.project = Project.objects.create(
            name='Test Project',
            description='Test description',
            created_by=self.manager_user,
            status='active'
        )
        self.project.members.add(self.employee_user)
        
        self.ticket = Ticket.objects.create(
            title='Test Ticket',
            description='Test description',
            type='task',
            priority='medium',
            status='in_progress',
            project=self.project,
            created_by=self.manager_user,
            assignee=self.employee_user
        )
    
    def test_start_work(self):
        """Test starting work on a ticket"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(f'/api/tickets/{self.ticket.id}/start_work/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('work_log_id', response.data)
        
        # Verify work log was created
        work_log = WorkLog.objects.get(id=response.data['work_log_id'])
        self.assertEqual(work_log.ticket, self.ticket)
        self.assertEqual(work_log.user, self.employee_user)
        self.assertIsNotNone(work_log.start_time)
        self.assertIsNone(work_log.end_time)
    
    def test_stop_work(self):
        """Test stopping work on a ticket"""
        # First start work
        work_log = WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=2),
            notes='Working on issue'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(f'/api/work-logs/{work_log.id}/stop/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        work_log.refresh_from_db()
        self.assertIsNotNone(work_log.end_time)
        self.assertGreater(work_log.duration_minutes, 0)
    
    def test_cannot_start_work_if_already_working(self):
        """Test that users cannot start work if already working on another ticket"""
        # Start work on first ticket
        WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now()
        )
        
        # Try to start work on another ticket
        ticket2 = Ticket.objects.create(
            title='Another Ticket',
            description='Another ticket',
            type='task',
            priority='low',
            status='new',
            project=self.project,
            created_by=self.manager_user,
            assignee=self.employee_user
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(f'/api/tickets/{ticket2.id}/start_work/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_work_logs(self):
        """Test listing work logs"""
        # Create some work logs
        WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=3),
            end_time=timezone.now() - timezone.timedelta(hours=2),
            duration_minutes=60,
            notes='First work session'
        )
        
        WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60,
            notes='Second work session'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/work-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_filter_work_logs_by_ticket(self):
        """Test filtering work logs by ticket"""
        work_log = WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/work-logs/?ticket={self.ticket.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['ticket'], self.ticket.id)
    
    def test_filter_work_logs_by_user(self):
        """Test filtering work logs by user"""
        work_log = WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60
        )
        
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(f'/api/work-logs/?user={self.employee_user.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
    
    def test_get_total_time_for_ticket(self):
        """Test getting total logged time for a ticket"""
        # Create multiple work logs
        WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=3),
            end_time=timezone.now() - timezone.timedelta(hours=2),
            duration_minutes=60
        )
        
        WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/tickets/{self.ticket.id}/total_time/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_minutes'], 120)
        self.assertEqual(response.data['total_hours'], 2.0)
    
    def test_work_log_includes_ticket_info(self):
        """Test that work logs include ticket information"""
        work_log = WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60,
            notes='Work session notes'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/work-logs/{work_log.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ticket', response.data)
        self.assertEqual(response.data['ticket']['id'], self.ticket.id)
        self.assertIn('user', response.data)
        self.assertIn('duration_minutes', response.data)
        self.assertIn('notes', response.data)
    
    def test_update_work_log_notes(self):
        """Test updating work log notes"""
        work_log = WorkLog.objects.create(
            ticket=self.ticket,
            user=self.employee_user,
            start_time=timezone.now() - timezone.timedelta(hours=1),
            end_time=timezone.now(),
            duration_minutes=60,
            notes='Original notes'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        data = {'notes': 'Updated notes'}
        response = self.client.patch(f'/api/work-logs/{work_log.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        work_log.refresh_from_db()
        self.assertEqual(work_log.notes, 'Updated notes')
    
    def test_non_member_cannot_create_work_log(self):
        """Test that non-project members cannot log work"""
        outsider = User.objects.create_user(
            username='outsider',
            email='outsider@test.com',
            password='outsiderpass123',
            role='employee'
        )
        
        self.client.force_authenticate(user=outsider)
        response = self.client.post(f'/api/tickets/{self.ticket.id}/start_work/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)