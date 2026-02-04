from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.comments.models import Comment


class CommentAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.employee_user = User.objects.create_user(
            username='employee',
            email='employee@test.com',
            password='employeepass123',
            role='employee'
        )
        self.another_employee = User.objects.create_user(
            username='employee2',
            email='employee2@test.com',
            password='employeepass123',
            role='employee'
        )
        
        # Create project and ticket
        self.project = Project.objects.create(
            name='Test Project',
            description='Test description',
            created_by=self.employee_user,
            status='active'
        )
        self.project.members.add(self.employee_user, self.another_employee)
        
        self.ticket = Ticket.objects.create(
            title='Test Ticket',
            description='Test description',
            type='bug',
            priority='high',
            status='new',
            project=self.project,
            created_by=self.employee_user
        )
        
        # Create comments
        self.comment1 = Comment.objects.create(
            ticket=self.ticket,
            author=self.employee_user,
            content='First comment on this ticket'
        )
        
        self.comment2 = Comment.objects.create(
            ticket=self.ticket,
            author=self.another_employee,
            content='Second comment with update'
        )
    
    def test_create_comment(self):
        """Test creating a comment on a ticket"""
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'ticket': self.ticket.id,
            'content': 'This is a new comment'
        }
        response = self.client.post('/api/comments/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'This is a new comment')
        self.assertEqual(response.data['author']['username'], 'employee')
    
    def test_list_comments_for_ticket(self):
        """Test listing comments for a specific ticket"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/comments/?ticket={self.ticket.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_update_own_comment(self):
        """Test updating your own comment"""
        self.client.force_authenticate(user=self.employee_user)
        data = {'content': 'Updated comment content'}
        response = self.client.patch(f'/api/comments/{self.comment1.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment1.refresh_from_db()
        self.assertEqual(self.comment1.content, 'Updated comment content')
    
    def test_cannot_update_others_comment(self):
        """Test that users cannot update others' comments"""
        self.client.force_authenticate(user=self.another_employee)
        data = {'content': 'Trying to hack this comment'}
        response = self.client.patch(f'/api/comments/{self.comment1.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_delete_own_comment(self):
        """Test deleting your own comment"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.delete(f'/api/comments/{self.comment1.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Comment.objects.filter(id=self.comment1.id).exists())
    
    def test_cannot_delete_others_comment(self):
        """Test that users cannot delete others' comments"""
        self.client.force_authenticate(user=self.another_employee)
        response = self.client.delete(f'/api/comments/{self.comment1.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_non_member_cannot_comment(self):
        """Test that non-project members cannot add comments"""
        outsider = User.objects.create_user(
            username='outsider',
            email='outsider@test.com',
            password='outsiderpass123',
            role='employee'
        )
        self.client.force_authenticate(user=outsider)
        data = {
            'ticket': self.ticket.id,
            'content': 'Unauthorized comment'
        }
        response = self.client.post('/api/comments/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_comment_includes_author_info(self):
        """Test that comments include author details"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/comments/{self.comment1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('author', response.data)
        self.assertEqual(response.data['author']['username'], 'employee')
        self.assertIn('created_at', response.data)
        self.assertIn('updated_at', response.data)
    
    def test_comments_ordered_by_created_at(self):
        """Test that comments are ordered chronologically"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/comments/?ticket={self.ticket.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Comments should be ordered by created_at ascending
        results = response.data['results']
        self.assertTrue(results[0]['created_at'] <= results[1]['created_at'])