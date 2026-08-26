from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import Client
from apps.customers.services.login_accounts import resync_client_login_accounts
from apps.core.populate_demo import (
    DEFAULT_PASSWORD,
    DEMO_TENANT_SCHEMA,
    run_all_demo_scenarios,
    seed_existing_demo_tenant,
    seed_projects_only,
    seed_users_only,
)
from apps.users.models import User


class Command(BaseCommand):
    help = 'Seed demo projects (and optional ticket scenarios) on an existing tenant.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            default=DEMO_TENANT_SCHEMA,
            help=f'Tenant schema_name or slug (default: {DEMO_TENANT_SCHEMA})',
        )
        parser.add_argument(
            '--password',
            default=DEFAULT_PASSWORD,
            help=f'Password when users must be created (default: {DEFAULT_PASSWORD})',
        )
        parser.add_argument(
            '--tickets',
            action='store_true',
            help='Also run ticket scenarios, bulk tickets, and related demo data',
        )

    def handle(self, *args, **options):
        client = self._resolve_client(options['tenant'].strip())
        password = options['password']

        with schema_context(client.schema_name):
            if not User.objects.exists():
                users = seed_users_only(client, password=password)
            else:
                users = None

            projects = seed_projects_only(client, password=password, users=users)

            if options['tickets']:
                ctx = seed_existing_demo_tenant(client, password=password)
                run_all_demo_scenarios(ctx)

        resync_client_login_accounts(client)
        message = (
            f'Seeded {len(projects)} project(s) with ticket scenarios on {client.schema_name}.'
            if options['tickets']
            else f'Seeded {len(projects)} project(s) on {client.schema_name}.'
        )
        self.stdout.write(self.style.SUCCESS(message))

    def _resolve_client(self, key: str) -> Client:
        with schema_context(get_public_schema_name()):
            client = Client.objects.filter(schema_name=key).first()
            if client is None:
                client = Client.objects.filter(slug=key).first()
            if client is None:
                raise CommandError(f'Tenant not found for schema/slug: {key}')
            return client
