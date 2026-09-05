from django.test import Client, TestCase, override_settings
from django_tenants.utils import get_tenant_model, schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Domain
from apps.customers.tenant_resolution import internal_domain_for
from apps.platform.admin_site import platform_admin_site
from apps.platform.models import PlatformUser
from apps.users.models import User


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
    def test_django_admin_index_loads_without_admin_log(self):
        self.client.login(username='django_admin_test', password='testpass123')
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)

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


class PlatformTenantAdminTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Tenant = get_tenant_model()
        cls.tenant = Tenant.objects.filter(schema_name='admin_tenant').first()
        if cls.tenant is None:
            cls.tenant = Tenant(
                schema_name='admin_tenant',
                name='Admin Tenant',
                slug='admin-tenant',
                login_domain='admin-tenant.local',
                is_active=True,
            )
            cls.tenant.save()
            Domain.objects.create(
                domain=internal_domain_for('admin_tenant'),
                tenant=cls.tenant,
                is_primary=True,
            )

    def setUp(self):
        self.client = Client()
        self.platform_user = PlatformUser.objects.create_user(
            username='tenant_admin_tester',
            password='testpass123',
            email='tenant-admin@test.local',
        )
        with schema_context(self.tenant.schema_name):
            User.objects.create_user(
                username='tenant-user-1',
                email='tenant-user-1@test.com',
                password='testpass123',
                role='employee',
            )

    @override_settings(
        STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    )
    def test_tenant_user_admin_requires_tenant_selection(self):
        self.client.login(username='tenant_admin_tester', password='testpass123')
        response = self.client.get('/admin/users/user/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Select a tenant')

    @override_settings(
        STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    )
    def test_tenant_user_admin_lists_users_for_selected_tenant(self):
        self.client.login(username='tenant_admin_tester', password='testpass123')
        session = self.client.session
        session['platform_admin_tenant_schema'] = self.tenant.schema_name
        session.save()

        response = self.client.get('/admin/users/user/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'tenant-user-1')

    def test_tenant_models_registered_on_platform_admin_site(self):
        self.assertIn(User, platform_admin_site._registry)
