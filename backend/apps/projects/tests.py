from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.projects.models import Project, ProjectMember
from apps.users.models import User


class ProjectAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users with different roles
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
        self.another_employee = User.objects.create_user(
            username='employee2',
            email='employee2@test.com',
            password='employeepass123',
            role='employee'
        )
        
        # Create a project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test project description',
            created_by=self.manager_user,
            status='active'
        )
        self.project.members.add(self.employee_user)
        
        # Create another project
        self.project2 = Project.objects.create(
            name='Another Project',
            description='Another project description',
            created_by=self.admin_user,
            status='active'
        )
        self.project2.members.add(self.another_employee)
    
    def test_manager_can_create_project(self):
        """Test that managers can create new projects"""
        self.client.force_authenticate(user=self.manager_user)
        data = {
            'name': 'New Project',
            'description': 'New project description',
            'status': 'active'
        }
        response = self.client.post('/api/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Project')
        self.assertEqual(response.data['created_by'], self.manager_user.id)
    
    def test_employee_cannot_create_project(self):
        """Test that employees cannot create projects"""
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'name': 'New Project',
            'description': 'New project description'
        }
        response = self.client.post('/api/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_user_can_list_projects(self):
        """Test that users can list projects they are members of"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see projects they are members of
        project_ids = [p['id'] for p in response.data['results']]
        self.assertIn(self.project.id, project_ids)
        self.assertNotIn(self.project2.id, project_ids)
    
    def test_manager_can_update_project(self):
        """Test that project creators can update their projects"""
        self.client.force_authenticate(user=self.manager_user)
        data = {
            'name': 'Updated Project Name',
            'description': 'Updated description'
        }
        response = self.client.patch(f'/api/projects/{self.project.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, 'Updated Project Name')
    
    def test_non_creator_cannot_update_project(self):
        """Test that non-creators cannot update projects"""
        self.client.force_authenticate(user=self.employee_user)
        data = {
            'name': 'Hacked Project Name'
        }
        response = self.client.patch(f'/api/projects/{self.project.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_manager_can_add_member_to_project(self):
        """Test adding members to a project"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(
            f'/api/projects/{self.project.id}/add_member/',
            {'user_id': self.another_employee.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.project.members.filter(id=self.another_employee.id).exists())
    
    def test_manager_can_remove_member_from_project(self):
        """Test removing members from a project"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(
            f'/api/projects/{self.project.id}/remove_member/',
            {'user_id': self.employee_user.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(self.project.members.filter(id=self.employee_user.id).exists())
    
    def test_employee_cannot_add_members(self):
        """Test that employees cannot add members to projects"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            f'/api/projects/{self.project.id}/add_member/',
            {'user_id': self.another_employee.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_manager_can_archive_project(self):
        """Test archiving a project"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(f'/api/projects/{self.project.id}/archive/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'archived')
    
    def test_project_detail_includes_members(self):
        """Test that project detail includes member information"""
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f'/api/projects/{self.project.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('members', response.data)
        member_ids = [m['id'] for m in response.data['members']]
        self.assertIn(self.employee_user.id, member_ids)


class ProjectPermissionsTestCase(TestCase):
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
        
        # Create projects
        self.project1 = Project.objects.create(
            name='Manager Project',
            description='Created by manager',
            created_by=self.manager_user,
            status='active'
        )
        self.project1.members.add(self.employee_user)
        
        self.project2 = Project.objects.create(
            name='Admin Project',
            description='Created by admin',
            created_by=self.admin_user,
            status='active'
        )
    
    def test_manager_sees_own_and_member_projects(self):
        """Test that managers see projects they created and are members of"""
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_ids = [p['id'] for p in response.data['results']]
        self.assertIn(self.project1.id, project_ids)
        self.assertNotIn(self.project2.id, project_ids)  # Not a member
    
    def test_admin_sees_all_projects(self):
        """Test that admins can see all projects"""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_ids = [p['id'] for p in response.data['results']]
        self.assertIn(self.project1.id, project_ids)
        self.assertIn(self.project2.id, project_ids)
    
    def test_unauthenticated_cannot_access_projects(self):
        """Test that unauthenticated users cannot access projects"""
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)