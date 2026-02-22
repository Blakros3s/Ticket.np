#!/usr/bin/env python
"""
Load testing script for TicketHub API
Uses locust for performance testing
"""

from locust import HttpUser, task, between
import random


class TicketHubUser(HttpUser):
    """Simulates a typical user interacting with TicketHub"""
    wait_time = between(1, 5)
    
    def on_start(self):
        """Login when user starts"""
        self.login()
    
    def login(self):
        """Authenticate user"""
        # You can customize credentials based on role distribution
        roles = ['admin', 'manager', 'employee']
        role = random.choice(roles)
        
        # Use test credentials
        credentials = {
            'admin': {'username': 'admin', 'password': 'admin123'},
            'manager': {'username': 'manager', 'password': 'managerpass123'},
            'employee': {'username': 'employee', 'password': 'employeepass123'}
        }
        
        response = self.client.post('/api/auth/login/', json=credentials[role])
        if response.status_code == 200:
            self.token = response.json()['access']
            self.client.headers.update({'Authorization': f'Bearer {self.token}'})
            self.user_role = role
    
    @task(5)
    def view_dashboard(self):
        """View dashboard based on role"""
        if hasattr(self, 'user_role'):
            if self.user_role == 'employee':
                self.client.get('/api/dashboard/employee/')
            elif self.user_role == 'manager':
                self.client.get('/api/dashboard/manager/')
            else:
                self.client.get('/api/dashboard/admin/')
    
    @task(4)
    def list_projects(self):
        """List projects"""
        self.client.get('/api/projects/')
    
    @task(3)
    def view_project_detail(self):
        """View project details"""
        # Assume project ID 1 exists
        self.client.get('/api/projects/1/')
    
    @task(4)
    def list_tickets(self):
        """List tickets with filters"""
        filters = [
            '',
            '?status=new',
            '?priority=high',
            '?type=bug',
            '?search=test'
        ]
        filter_param = random.choice(filters)
        self.client.get(f'/api/tickets/{filter_param}')
    
    @task(2)
    def create_ticket(self):
        """Create a new ticket"""
        if hasattr(self, 'user_role') and self.user_role in ['manager', 'employee']:
            ticket_data = {
                'title': f'Load Test Ticket {random.randint(1, 1000)}',
                'description': 'This is a load test ticket',
                'type': random.choice(['bug', 'task', 'feature']),
                'priority': random.choice(['low', 'medium', 'high', 'critical']),
                'project': 1  # Assume project ID 1 exists
            }
            self.client.post('/api/tickets/', json=ticket_data)
    
    @task(3)
    def view_ticket_detail(self):
        """View ticket details"""
        # Assume ticket ID 1 exists
        self.client.get('/api/tickets/1/')
    
    @task(2)
    def update_ticket_status(self):
        """Update ticket status"""
        statuses = ['new', 'in_progress', 'qa', 'closed']
        new_status = random.choice(statuses)
        self.client.post(f'/api/tickets/1/change_status/', json={'status': new_status})
    
    @task(2)
    def add_comment(self):
        """Add a comment to a ticket"""
        comment_data = {
            'ticket': 1,
            'content': f'Test comment {random.randint(1, 1000)}'
        }
        self.client.post('/api/comments/', json=comment_data)
    
    @task(2)
    def view_comments(self):
        """View comments for a ticket"""
        self.client.get('/api/comments/?ticket=1')
    
    @task(1)
    def start_work(self):
        """Start work on a ticket"""
        self.client.post('/api/tickets/1/start_work/')
    
    @task(1)
    def view_work_logs(self):
        """View work logs"""
        self.client.get('/api/work-logs/')
    
    @task(1)
    def view_activity_logs(self):
        """View activity logs"""
        self.client.get('/api/activity-logs/')
    
    @task(2)
    def search_tickets(self):
        """Search for tickets"""
        search_terms = ['bug', 'feature', 'login', 'error', 'test']
        term = random.choice(search_terms)
        self.client.get(f'/api/tickets/?search={term}')


class HeavyUser(HttpUser):
    """Simulates a heavy user performing many operations"""
    wait_time = between(0.1, 0.5)
    
    def on_start(self):
        self.login()
    
    def login(self):
        response = self.client.post('/api/auth/login/', json={
            'username': 'admin',
            'password': 'admin123'
        })
        if response.status_code == 200:
            self.token = response.json()['access']
            self.client.headers.update({'Authorization': f'Bearer {self.token}'})
    
    @task(10)
    def rapid_ticket_listing(self):
        """Rapidly list tickets"""
        self.client.get('/api/tickets/')
    
    @task(5)
    def rapid_project_listing(self):
        """Rapidly list projects"""
        self.client.get('/api/projects/')
    
    @task(3)
    def rapid_user_listing(self):
        """Rapidly list users"""
        self.client.get('/api/auth/users/')


# Run with: locust -f backend/load_test.py --host=http://localhost:8000