from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from datetime import date, timedelta

from .models import TodoItem

User = get_user_model()


class TodoItemAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            role='employee'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            password='testpass123',
            role='employee'
        )
        
        self.todo = TodoItem.objects.create(
            user=self.user,
            title='Test Todo',
            description='Test Description',
            priority='high',
            status='pending',
            due_date=date.today() + timedelta(days=7)
        )
        
        self.other_todo = TodoItem.objects.create(
            user=self.other_user,
            title='Other Todo',
            priority='low'
        )
    
    def test_list_todos(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/todos/todos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Test Todo')
    
    def test_list_todos_other_user_cannot_see(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get('/api/todos/todos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Other Todo')
    
    def test_create_todo(self):
        self.client.force_authenticate(user=self.user)
        data = {
            'title': 'New Todo',
            'description': 'New Description',
            'priority': 'medium',
            'status': 'in_progress'
        }
        response = self.client.post('/api/todos/todos/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TodoItem.objects.filter(user=self.user).count(), 2)
    
    def test_update_own_todo(self):
        self.client.force_authenticate(user=self.user)
        data = {'title': 'Updated Todo'}
        response = self.client.patch(f'/api/todos/todos/{self.todo.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.todo.refresh_from_db()
        self.assertEqual(self.todo.title, 'Updated Todo')
    
    def test_cannot_update_other_user_todo(self):
        self.client.force_authenticate(user=self.user)
        data = {'title': 'Hacked Todo'}
        response = self.client.patch(f'/api/todos/todos/{self.other_todo.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_delete_own_todo(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f'/api/todos/todos/{self.todo.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TodoItem.objects.filter(user=self.user).count(), 0)
    
    def test_complete_todo(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/todos/todos/{self.todo.id}/complete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.todo.refresh_from_db()
        self.assertTrue(self.todo.is_completed)
        self.assertEqual(self.todo.status, 'completed')
    
    def test_reopen_todo(self):
        self.client.force_authenticate(user=self.user)
        self.todo.is_completed = True
        self.todo.status = 'completed'
        self.todo.save()
        
        response = self.client.post(f'/api/todos/todos/{self.todo.id}/reopen/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.todo.refresh_from_db()
        self.assertFalse(self.todo.is_completed)
        self.assertEqual(self.todo.status, 'pending')
    
    def test_stats_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/todos/todos/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['pending'], 1)
        self.assertEqual(response.data['completed'], 0)
    
    def test_priorities_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/todos/todos/priorities/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
    
    def test_filter_by_priority(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/todos/todos/?priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        
        response = self.client.get('/api/todos/todos/?priority=low')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)
    
    def test_bulk_complete(self):
        todo2 = TodoItem.objects.create(user=self.user, title='Todo 2')
        self.client.force_authenticate(user=self.user)
        
        data = {'ids': [self.todo.id, todo2.id]}
        response = self.client.post('/api/todos/todos/bulk_complete/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 2)
        
        self.todo.refresh_from_db()
        todo2.refresh_from_db()
        self.assertTrue(self.todo.is_completed)
        self.assertTrue(todo2.is_completed)
    
    def test_bulk_delete(self):
        todo2 = TodoItem.objects.create(user=self.user, title='Todo 2')
        self.client.force_authenticate(user=self.user)
        
        data = {'ids': [self.todo.id, todo2.id]}
        response = self.client.post('/api/todos/todos/bulk_delete/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['deleted'], 2)
        self.assertEqual(TodoItem.objects.filter(user=self.user).count(), 0)
