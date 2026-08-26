from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import Client
from apps.customers.services.login_accounts import resync_client_login_accounts
from apps.core.populate_demo import (
    DEFAULT_PASSWORD,
    DEMO_TENANT_SCHEMA,
    seed_users_only,
)


class Command(BaseCommand):
    help = 'Seed demo staff users on an existing tenant (granular partial seed).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            default=DEMO_TENANT_SCHEMA,
            help=f'Tenant schema_name or slug (default: {DEMO_TENANT_SCHEMA})',
        )
        parser.add_argument(
            '--password',
            default=DEFAULT_PASSWORD,
            help=f'Password for seeded users (default: {DEFAULT_PASSWORD})',
        )

    def handle(self, *args, **options):
        client = self._resolve_client(options['tenant'].strip())
        password = options['password']

        with schema_context(client.schema_name):
            users = seed_users_only(client, password=password)

        synced = resync_client_login_accounts(client)
        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(users)} user(s) on {client.schema_name}. Synced {synced} login account(s).'
        ))

    def _resolve_client(self, key: str) -> Client:
        with schema_context(get_public_schema_name()):
            client = Client.objects.filter(schema_name=key).first()
            if client is None:
                client = Client.objects.filter(slug=key).first()
            if client is None:
                raise CommandError(f'Tenant not found for schema/slug: {key}')
            return client
