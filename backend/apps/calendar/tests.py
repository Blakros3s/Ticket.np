from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, time

from .models import CalendarEvent

User = get_user_model()


class CalendarEventAPITests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            password='testpass123',
            role='admin'
        )
        self.employee_user = User.objects.create_user(
            username='employee',
            password='testpass123',
            role='employee'
        )
        self.manager_user = User.objects.create_user(
            username='manager',
            password='testpass123',
            role='manager'
        )
        
        self.event = CalendarEvent.objects.create(
            title='Test Holiday',
            description='Independence Day',
            date=date(2026, 1, 26),
            category='holiday',
            created_by=self.admin_user
        )
    
    def test_list_events_as_employee(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/calendar/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
    
    def test_list_events_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/calendar/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_create_event_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': 'New Event',
            'description': 'Test Description',
            'date': '2026-02-01',
            'category': 'meeting'
        }
        response = self.client.post('/api/calendar/events/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CalendarEvent.objects.count(), 2)
    
    def test_create_event_as_employee_fails(self):
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'title': 'New Event',
            'date': '2026-02-01',
            'category': 'meeting'
        }
        response = self.client.post('/api/calendar/events/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_update_event_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        data = {'title': 'Updated Holiday'}
        response = self.client.patch(f'/api/calendar/events/{self.event.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.title, 'Updated Holiday')
    
    def test_delete_event_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(f'/api/calendar/events/{self.event.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(CalendarEvent.objects.count(), 0)
    
    def test_month_endpoint(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/calendar/events/month/?year=2026&month=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['year'], 2026)
        self.assertEqual(response.data['month'], 1)
        self.assertEqual(len(response.data['events']), 1)
    
    def test_categories_endpoint(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/calendar/events/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 6)  # 6 categories
