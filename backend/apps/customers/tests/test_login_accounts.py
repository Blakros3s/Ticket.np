from django.test import TestCase
from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import Client, Domain, TenantLoginAccount
from apps.customers.services.login_accounts import (
    build_login_identifier,
    register_login_account,
    resolve_login_account,
    sync_login_account_username,
    update_client_login_domain,
)
from apps.customers.tenant_resolution import internal_domain_for
from apps.users.models import User


class ResolveLoginAccountTests(TestCase):
    def setUp(self):
        self.client_obj = Client(
            schema_name='main',
            name='Main Organization',
            slug='main',
            login_domain='technest.com',
            is_active=True,
        )
        self.client_obj.save()
        Domain.objects.create(
            domain=internal_domain_for('main'),
            tenant=self.client_obj,
            is_primary=True,
        )

        with schema_context('main'):
            self.user = User.objects.create_user(
                username='mike.brown',
                email='mike.brown@tickethub.com',
                password='technest2026',
                role='employee',
            )
        register_login_account(client=self.client_obj, user=self.user)
        self.login_id = build_login_identifier(
            local_username='mike.brown',
            login_domain=self.client_obj.login_domain,
        )

    def test_resolve_canonical_login_id(self):
        self.assertIsNotNone(resolve_login_account(self.login_id))

    def test_rejects_profile_email_login(self):
        self.assertIsNone(resolve_login_account('mike.brown@tickethub.com'))

    def test_rejects_wrong_domain_login(self):
        self.assertIsNone(resolve_login_account('mike.brown@wrong.example'))

    def test_rejects_local_part_only(self):
        self.assertIsNone(resolve_login_account('mike.brown'))


class SyncLoginAccountTests(TestCase):
    def setUp(self):
        self.client_obj = Client(
            schema_name='sync_tenant',
            name='Sync Tenant',
            slug='sync-tenant',
            login_domain='technest',
            is_active=True,
        )
        self.client_obj.save()
        Domain.objects.create(
            domain=internal_domain_for('sync_tenant'),
            tenant=self.client_obj,
            is_primary=True,
        )
        with schema_context('sync_tenant'):
            self.user = User.objects.create_user(
                username='admin',
                email='owner@example.com',
                password='technest2026',
                role='admin',
            )
        register_login_account(client=self.client_obj, user=self.user)

    def test_username_change_updates_public_login_id(self):
        with schema_context('sync_tenant'):
            self.user.username = 'adminkol'
            self.user.save(update_fields=['username'])

        sync_login_account_username(
            client=self.client_obj,
            user=self.user,
            previous_username='admin',
        )

        with schema_context(get_public_schema_name()):
            account = TenantLoginAccount.objects.get(
                client=self.client_obj,
                tenant_user_id=self.user.pk,
            )
        self.assertEqual(account.username, 'adminkol@technest')
        self.assertIsNotNone(resolve_login_account('adminkol@technest'))
        self.assertIsNone(resolve_login_account('admin@technest'))

    def test_login_domain_change_resyncs_all_accounts(self):
        with schema_context('sync_tenant'):
            User.objects.create_user(
                username='dev1',
                email='dev1@example.com',
                password='technest2026',
                role='employee',
            )
            users = list(User.objects.all())
        for user in users:
            register_login_account(client=self.client_obj, user=user)

        updated = update_client_login_domain(client=self.client_obj, login_domain='technest.com')
        self.assertEqual(updated.login_domain, 'technest.com')

        with schema_context(get_public_schema_name()):
            accounts = {
                account.tenant_user_id: account.username
                for account in TenantLoginAccount.objects.filter(client=self.client_obj)
            }
        self.assertEqual(accounts[self.user.pk], 'admin@technest.com')
        self.assertIsNotNone(resolve_login_account('admin@technest.com'))
