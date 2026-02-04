from django.test import TestCase
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.activity.models import ActivityLog


class ActivityLogTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='adminpass123',
            role='admin'
        )
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        
        # Create project and ticket
        self.project = Project.objects.create(
            name='Test Project',
            description='Test description',
            created_by=self.admin_user,
            status='active'
        )
        self.project.members.add(self.employee_user)
        
        self.ticket = Ticket.objects.create(
            title='Test Ticket',
            description='Test description',
            type='bug',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.employee_user
        )
    
    def test_activity_log_created_on_ticket_create(self):
        """Test that activity log is created when ticket is created"""
        activities = ActivityLog.objects.filter(
            action='create',
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id
        )
        self.assertTrue(activities.exists())
        self.assertEqual(activities.first().user, self.employee_user)
    
    def test_activity_log_created_on_ticket_update(self):
        """Test that activity log is created when ticket is updated"""
        self.client.force_authenticate(user=self.employee_user)
        
        # Update the ticket
        response = self.client.patch(
            f'/api/tickets/{self.ticket.id}/',
            {'title': 'Updated Title'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check activity log was created
        activities = ActivityLog.objects.filter(
            action='update',
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id
        )
        self.assertTrue(activities.exists())
    
    def test_activity_log_created_on_status_change(self):
        """Test that activity log is created when ticket status changes"""
        self.client.force_authenticate(user=self.employee_user)
        
        # Change status
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'in_progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check activity log was created
        activities = ActivityLog.objects.filter(
            action='status_change',
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id
        )
        self.assertTrue(activities.exists())
        activity = activities.first()
        self.assertEqual(activity.extra_data.get('old_status'), 'new')
        self.assertEqual(activity.extra_data.get('new_status'), 'in_progress')
    
    def test_activity_log_created_on_assignment_change(self):
        """Test that activity log is created when ticket assignee changes"""
        new_assignee = User.objects.create_user(
            username='new_assignee',
            email='new_assignee@test.com',
            password='assigneepass123',
            role='employee'
        )
        self.project.members.add(new_assignee)
        
        self.client.force_authenticate(user=self.admin_user)
        
        # Change assignee
        response = self.client.patch(
            f'/api/tickets/{self.ticket.id}/',
            {'assignee': new_assignee.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check activity log was created
        activities = ActivityLog.objects.filter(
            action='assignment_change',
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id
        )
        self.assertTrue(activities.exists())
    
    def test_list_activity_logs(self):
        """Test listing activity logs"""
        # Create some activity logs
        ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description=f'Created ticket {self.ticket.ticket_id}'
        )
        
        ActivityLog.objects.create(
            action='update',
            user=self.admin_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description=f'Updated ticket {self.ticket.ticket_id}'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/activity-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_filter_activity_logs_by_action(self):
        """Test filtering activity logs by action type"""
        ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description=f'Created ticket {self.ticket.ticket_id}'
        )
        
        ActivityLog.objects.create(
            action='update',
            user=self.admin_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description=f'Updated ticket {self.ticket.ticket_id}'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/activity-logs/?action=create')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['action'], 'create')
    
    def test_filter_activity_logs_by_user(self):
        """Test filtering activity logs by user"""
        ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='Activity by employee'
        )
        
        ActivityLog.objects.create(
            action='update',
            user=self.admin_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='Activity by admin'
        )
        
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'/api/activity-logs/?user={self.employee_user.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['user']['id'], self.employee_user.id)
    
    def test_get_ticket_activity_history(self):
        """Test getting activity history for a specific ticket"""
        # Create multiple activities for the ticket
        ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description=f'Created ticket {self.ticket.ticket_id}'
        )
        
        ActivityLog.objects.create(
            action='status_change',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='Changed status to In Progress',
            extra_data={'old_status': 'new', 'new_status': 'in_progress'}
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/tickets/{self.ticket.id}/activity/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_activity_log_ordered_by_created_at_desc(self):
        """Test that activity logs are ordered by created_at descending (newest first)"""
        from django.utils import timezone
        import time
        
        # Create first activity
        activity1 = ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='First activity'
        )
        
        time.sleep(0.1)  # Small delay to ensure different timestamps
        
        # Create second activity
        activity2 = ActivityLog.objects.create(
            action='update',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='Second activity'
        )
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/activity-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        # Newest first
        self.assertEqual(results[0]['id'], activity2.id)
        self.assertEqual(results[1]['id'], activity1.id)
    
    def test_activity_logs_are_read_only(self):
        """Test that activity logs cannot be created/updated/deleted via API"""
        self.client.force_authenticate(user=self.admin_user)
        
        # Try to create
        data = {
            'action': 'create',
            'description': 'Manual activity'
        }
        response = self.client.post('/api/activity-logs/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        
        # Create an activity log directly in DB
        activity = ActivityLog.objects.create(
            action='create',
            user=self.employee_user,
            content_type=ContentType.objects.get_for_model(Ticket),
            object_id=self.ticket.id,
            description='Test activity'
        )
        
        # Try to update
        response = self.client.patch(f'/api/activity-logs/{activity.id}/', {'description': 'Hacked'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        
        # Try to delete
        response = self.client.delete(f'/api/activity-logs/{activity.id}/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_project_activity_log_created(self):
        """Test that activity log is created when project is created"""
        project = Project.objects.create(
            name='New Project',
            description='New project description',
            created_by=self.admin_user,
            status='active'
        )
        
        activities = ActivityLog.objects.filter(
            action='create',
            content_type=ContentType.objects.get_for_model(Project),
            object_id=project.id
        )
        self.assertTrue(activities.exists())
        self.assertEqual(activities.first().user, self.admin_user)