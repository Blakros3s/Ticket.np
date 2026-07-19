from django.core.management.base import BaseCommand

from apps.customers.models import Plan
from apps.customers.services.plans import ensure_default_plans
from apps.customers.services.tenants import TenantProvisionError, create_client_with_admin
from apps.platform.models import PlatformUser


class Command(BaseCommand):
    help = 'Create a tenant schema, domain, and initial admin user.'

    def add_arguments(self, parser):
        parser.add_argument('--schema_name', required=True, help='PostgreSQL schema name')
        parser.add_argument('--name', required=True, help='Display name')
        parser.add_argument('--slug', default='', help='URL slug (derived from name if omitted)')
        parser.add_argument('--domain', default='', help='Primary domain (default: <schema>.localhost)')
        parser.add_argument('--admin-username', required=True)
        parser.add_argument('--admin-password', required=True)
        parser.add_argument('--plan', default='', help='Plan name to assign (optional)')

    def handle(self, *args, **options):
        plan = None
        plan_name = options['plan'].strip()
        if plan_name:
            try:
                plan = Plan.objects.get(name=plan_name)
            except Plan.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Plan not found: {plan_name}'))
                return

        try:
            client, admin = create_client_with_admin(
                name=options['name'],
                slug=options['slug'] or options['schema_name'],
                schema_name=options['schema_name'],
                domain=options['domain'] or None,
                admin_username=options['admin_username'],
                admin_password=options['admin_password'],
                plan=plan,
            )
        except TenantProvisionError as exc:
            self.stderr.write(self.style.ERROR(exc.message))
            return

        self.stdout.write(self.style.SUCCESS(
            f'Created tenant "{client.name}" (schema={client.schema_name}, admin={admin.username})'
        ))
