from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.tickets.serializers import sanitize_multiline_text


class SanitizeMultilineTextTestCase(TestCase):
    def test_preserves_plain_text_line_breaks(self):
        value = "First line\nSecond line\n\nThird paragraph"
        self.assertEqual(sanitize_multiline_text(value), value)

    def test_converts_html_breaks_to_newlines(self):
        value = "<p>First paragraph</p><p>Second paragraph</p>Line one<br>Line two"
        result = sanitize_multiline_text(value)
        self.assertIn("First paragraph\n", result)
        self.assertIn("Second paragraph\n", result)
        self.assertIn("Line one\nLine two", result)


class TicketAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='adminpass123',
            role='admin'
        )
        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='managerpass123',
            role='manager'
        )
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        self.assignee_user = User.objects.create_user(
            username='assignee',
            email='assignee@test.com',
            password='assigneepass123',
            role='employee'
        )
        
        # Create project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test description',
            created_by=self.manager_user,
            status='active'
        )
        self.project.members.add(self.employee_user, self.assignee_user)
        
        # Create tickets
        self.ticket = Ticket.objects.create(
            title='Test Ticket',
            description='Test ticket description',
            type='bug',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.employee_user
        )
        self.ticket.assignees.add(self.assignee_user)
        
        self.ticket2 = Ticket.objects.create(
            title='Another Ticket',
            description='Another description',
            type='task',
            priority='medium',
            status='in_progress',
            project=self.project,
            created_by=self.manager_user
        )
        self.ticket2.assignees.add(self.employee_user)
    
    def test_create_ticket(self):
        """Test creating a new ticket"""
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'title': 'New Ticket',
            'description': 'New ticket description',
            'type': 'feature',
            'priority': 'critical',
            'project': self.project.id,
            'assignees': [self.assignee_user.id]
        }
        response = self.client.post('/api/tickets/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'New Ticket')
        self.assertEqual(response.data['type'], 'feature')
        self.assertEqual(response.data['priority'], 'critical')
        self.assertIn('ticket_id', response.data)
    
    def test_list_tickets(self):
        """Test listing tickets"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_filter_tickets_by_status(self):
        """Test filtering tickets by status"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/?status=new')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'new')
    
    def test_filter_tickets_by_priority(self):
        """Test filtering tickets by priority"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/?priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['priority'], 'high')
    
    def test_filter_tickets_by_assignee(self):
        """Test filtering tickets by assignee"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/tickets/?assignee={self.assignee_user.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIn(self.assignee_user.id, response.data['results'][0]['assignees'])
    
    def test_update_ticket_status(self):
        """Test updating ticket status"""
        self.client.force_authenticate(user=self.assignee_user)
        data = {'status': 'in_progress'}
        response = self.client.patch(f'/api/tickets/{self.ticket.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'in_progress')
    
    def test_manager_can_update_any_ticket(self):
        """Test that managers can update any ticket in their projects"""
        self.client.force_authenticate(user=self.manager_user)
        data = {'priority': 'critical'}
        response = self.client.patch(f'/api/tickets/{self.ticket.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.priority, 'critical')
    
    def test_non_member_cannot_create_ticket(self):
        """Test that non-project members cannot create tickets"""
        outsider = User.objects.create_user(
            username='outsider',
            email='outsider@test.com',
            password='outsiderpass123',
            role='employee'
        )
        self.client.force_authenticate(user=outsider)
        data = {
            'title': 'Unauthorized Ticket',
            'description': 'Should not be created',
            'project': self.project.id
        }
        response = self.client.post('/api/tickets/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_ticket_detail(self):
        """Test retrieving ticket details"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/tickets/{self.ticket.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Ticket')
        self.assertEqual(response.data['ticket_id'], self.ticket.ticket_id)
        self.assertIn('project', response.data)
        self.assertIn('assignees', response.data)
        self.assertIn('created_by', response.data)
    
    def test_delete_ticket(self):
        """Test deleting a ticket"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.delete(f'/api/tickets/{self.ticket.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Ticket.objects.filter(id=self.ticket.id).exists())
    
    def test_creator_can_delete_own_ticket(self):
        """Test that ticket creators can delete their own tickets"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.delete(f'/api/tickets/{self.ticket.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class TicketStatusFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='managerpass123',
            role='manager'
        )
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        
        self.project = Project.objects.create(
            name='Test Project',
            description='Test description',
            created_by=self.manager_user,
            status='active'
        )
        self.project.members.add(self.employee_user)
        
        self.ticket = Ticket.objects.create(
            title='Status Test Ticket',
            description='Testing status flow',
            type='task',
            priority='medium',
            status='new',
            project=self.project,
            created_by=self.manager_user
        )
        self.ticket.assignees.add(self.employee_user)
    
    def test_status_transition_new_to_in_progress(self):
        """Test transitioning from New to In Progress"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'in_progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'in_progress')
    
    def test_status_transition_in_progress_to_qa(self):
        """Test transitioning from In Progress to QA"""
        self.ticket.status = 'in_progress'
        self.ticket.save()
        
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'qa'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'qa')
    
    def test_status_transition_qa_to_closed(self):
        """Test transitioning from QA to Closed"""
        self.ticket.status = 'qa'
        self.ticket.save()
        
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'closed'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'closed')
    
    def test_status_transition_closed_to_reopened(self):
        """Test reopening a closed ticket"""
        self.ticket.status = 'closed'
        self.ticket.save()
        
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'reopened'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'reopened')
    
    def test_invalid_status_transition(self):
        """Test that invalid status transitions are blocked"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            f'/api/tickets/{self.ticket.id}/change_status/',
            {'status': 'closed'},  # Cannot go from New to Closed directly
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TicketSearchTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        
        self.project = Project.objects.create(
            name='Search Test Project',
            description='Test description',
            created_by=self.employee_user,
            status='active'
        )
        self.project.members.add(self.employee_user)
        
        # Create tickets with different content
        self.ticket1 = Ticket.objects.create(
            title='Login page bug',
            description='Users cannot login with special characters',
            type='bug',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.employee_user
        )
        
        self.ticket2 = Ticket.objects.create(
            title='Add dark mode feature',
            description='Implement dark mode toggle in settings',
            type='feature',
            priority='medium',
            status='in_progress',
            project=self.project,
            created_by=self.employee_user
        )
        
        self.ticket3 = Ticket.objects.create(
            title='Database optimization',
            description='Improve query performance for dashboard',
            type='task',
            priority='low',
            status='new',
            project=self.project,
            created_by=self.employee_user
        )
    
    def test_search_by_title(self):
        """Test searching tickets by title"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/?search=login')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Login page bug')
    
    def test_search_by_description(self):
        """Test searching tickets by description"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/?search=dark+mode')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Add dark mode feature')
    
    def test_search_by_ticket_id(self):
        """Test searching tickets by ticket ID"""
        self.client.force_authenticate(user=self.employee_user)
        ticket_id = self.ticket1.ticket_id
        response = self.client.get(f'/api/tickets/?search={ticket_id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['ticket_id'], ticket_id)
    
    def test_combined_filters(self):
        """Test combining search with filters"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/tickets/?search=bug&type=bug')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['type'], 'bug')


class TicketStatsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.manager_user = User.objects.create_user(
            username='stats_manager',
            email='stats_manager@test.com',
            password='managerpass123',
            role='manager',
        )
        self.assignee_user = User.objects.create_user(
            username='stats_assignee',
            email='stats_assignee@test.com',
            password='assigneepass123',
            role='employee',
        )

        self.project = Project.objects.create(
            name='Stats Project',
            description='Stats test project',
            created_by=self.manager_user,
            status='active',
        )
        self.project.members.add(self.manager_user, self.assignee_user)

        self.ticket_new = Ticket.objects.create(
            title='Stats ticket new',
            description='New ticket',
            type='bug',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.manager_user,
        )
        self.ticket_new.assignees.add(self.manager_user, self.assignee_user)

        self.ticket_progress = Ticket.objects.create(
            title='Stats ticket progress',
            description='In progress ticket',
            type='task',
            priority='medium',
            status='in_progress',
            project=self.project,
            created_by=self.manager_user,
        )
        self.ticket_progress.assignees.add(self.assignee_user)

        self.ticket_closed = Ticket.objects.create(
            title='Stats ticket closed',
            description='Closed ticket',
            type='feature',
            priority='low',
            status='closed',
            project=self.project,
            created_by=self.manager_user,
        )

    def _status_sum(self, data):
        return sum(data[key] for key in ('new', 'in_progress', 'qa', 'closed', 'reopened'))

    def test_stats_total_matches_status_breakdown(self):
        """All count must equal the sum of individual status tabs."""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get('/api/tickets/tickets/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['total'], self._status_sum(data))
        self.assertEqual(data['new'], 1)
        self.assertEqual(data['in_progress'], 1)
        self.assertEqual(data['closed'], 1)
        self.assertEqual(data['total'], 3)

    def test_stats_respects_non_status_filters(self):
        """Priority/type filters should apply to stats the same way as list."""
        self.client.force_authenticate(user=self.manager_user)

        response = self.client.get('/api/tickets/tickets/stats/?priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['new'], 1)
        self.assertEqual(response.data['in_progress'], 0)

    def test_list_count_matches_stats_total(self):
        """Paginated list count should stay in sync with stats total."""
        self.client.force_authenticate(user=self.manager_user)

        stats_response = self.client.get('/api/tickets/tickets/stats/')
        list_response = self.client.get('/api/tickets/tickets/')

        self.assertEqual(stats_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], stats_response.data['total'])