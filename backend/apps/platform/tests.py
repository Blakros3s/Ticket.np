from django.test import Client, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.platform.models import PlatformUser


class PlatformAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = PlatformUser.objects.create_user(
            username='platform_test_admin',
            password='testpass123',
            email='platform@test.local',
        )

    def test_platform_login(self):
        response = self.client.post(
            '/api/server/auth/login/',
            {'username': 'platform_test_admin', 'password': 'testpass123'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], 'server_admin')

    def test_platform_login_invalid_password(self):
        response = self.client.post(
            '/api/server/auth/login/',
            {'username': 'platform_test_admin', 'password': 'wrong'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_platform_token_refresh(self):
        login = self.client.post(
            '/api/server/auth/login/',
            {'username': 'platform_test_admin', 'password': 'testpass123'},
            format='json',
        )
        response = self.client.post(
            '/api/server/auth/token/refresh/',
            {'refresh': login.data['refresh']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)


class PlatformDjangoAdminTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = PlatformUser.objects.create_user(
            username='django_admin_test',
            password='testpass123',
            email='admin@test.local',
        )

    @override_settings(
        STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    )
    def test_django_admin_login_with_platform_user(self):
        response = self.client.post(
            '/admin/login/',
            {
                'username': 'django_admin_test',
                'password': 'testpass123',
                'next': '/admin/',
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/admin/')

    @override_settings(
        STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    )
    def test_django_admin_login_wrong_password_does_not_crash(self):
        response = self.client.post(
            '/admin/login/',
            {
                'username': 'django_admin_test',
                'password': 'wrong',
                'next': '/admin/',
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Please enter the correct')
