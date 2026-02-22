from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import User

User = get_user_model()


class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
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
    
    def test_user_registration(self):
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'username': 'newuser',
            'email': 'newuser@test.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'newpass123',
            'confirm_password': 'newpass123'
        }
        response = self.client.post('/api/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertTrue(User.objects.filter(username='newuser').exists())
    
    def test_user_registration_password_mismatch(self):
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'username': 'newuser',
            'email': 'newuser@test.com',
            'password': 'newpass123',
            'confirm_password': 'differentpass'
        }
        response = self.client.post('/api/auth/register/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_user_login(self):
        data = {
            'username': 'admin',
            'password': 'adminpass123'
        }
        response = self.client.post('/api/auth/login/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['role'], 'admin')
    
    def test_token_refresh(self):
        login_response = self.client.post('/api/auth/login/', {
            'username': 'admin',
            'password': 'adminpass123'
        }, format='json')
        refresh_token = login_response.data['refresh']
        
        response = self.client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
    
    def test_get_user_profile_authenticated(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'employee')
    
    def test_get_user_profile_unauthenticated(self):
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_update_user_profile(self):
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'first_name': 'Updated',
            'email': 'updated@test.com'
        }
        response = self.client.patch('/api/auth/profile/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee_user.refresh_from_db()
        self.assertEqual(self.employee_user.first_name, 'Updated')
    
    def test_admin_can_list_all_users(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
    
    def test_employee_can_only_list_active_users(self):
        inactive_user = User.objects.create_user(
            username='inactive',
            email='inactive@test.com',
            password='inactivepass123',
            role='employee',
            is_active=False
        )
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(inactive_user.id, [user['id'] for user in response.data['results']])
    
    def test_admin_can_deactivate_user(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(f'/api/auth/users/{self.employee_user.id}/deactivate/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee_user.refresh_from_db()
        self.assertFalse(self.employee_user.is_active)
    
    def test_employee_cannot_deactivate_user(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(f'/api/auth/users/{self.manager_user.id}/deactivate/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
