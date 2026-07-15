from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import get_tenant_model, schema_context

from apps.customers.models import Domain
from apps.customers.services.login_accounts import (
    default_login_domain_for_slug,
    resync_client_login_accounts,
)
from apps.customers.services.plans import assign_plan_to_client, ensure_default_plans, get_subscription_display
from apps.customers.tenant_resolution import internal_domain_for
from populate import DEFAULT_TENANT_SCHEMA, main

DEFAULT_MAIN_LOGIN_DOMAIN = 'technest.com'


class Command(BaseCommand):
    help = (
        'Populate TicketHub with realistic dummy data inside a tenant schema. '
        'Use --clear to wipe tenant data first.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear tenant data (keeps admin user) before populating',
        )
        parser.add_argument(
            '--schema',
            default=DEFAULT_TENANT_SCHEMA,
            help=f'Tenant schema to populate (default: {DEFAULT_TENANT_SCHEMA})',
        )
        parser.add_argument(
            '--login-domain',
            default='',
            help=f'Login domain postfix (default: {DEFAULT_MAIN_LOGIN_DOMAIN} for main, else slug.local)',
        )

    def handle(self, *args, **options):
        schema_name = options['schema'].strip()
        if not schema_name or schema_name == 'public':
            raise CommandError('Refusing to populate the public schema. Use a tenant schema such as "main".')

        login_domain = options['login_domain'].strip()
        tenant = self._ensure_tenant(schema_name, login_domain=login_domain)

        standard, _premium = ensure_default_plans()
        if get_subscription_display(tenant) is None:
            assign_plan_to_client(client=tenant, plan=standard)
            self.stdout.write(self.style.SUCCESS(f'Assigned "{standard.name}" plan to tenant "{schema_name}"'))

        self.stdout.write(f'Populating tenant schema: {schema_name}')
        with schema_context(schema_name):
            main(clear=options['clear'])

        synced = resync_client_login_accounts(tenant)
        self.stdout.write(self.style.SUCCESS(
            f'Synced {synced} login account(s) (@{tenant.login_domain})'
        ))

    def _ensure_tenant(self, schema_name: str, *, login_domain: str = ''):
        Tenant = get_tenant_model()
        slug = schema_name.replace('_', '-')
        resolved_login_domain = login_domain or (
            DEFAULT_MAIN_LOGIN_DOMAIN
            if schema_name == DEFAULT_TENANT_SCHEMA
            else default_login_domain_for_slug(slug)
        )

        tenant = Tenant.objects.filter(schema_name=schema_name).first()
        if tenant:
            if tenant.login_domain != resolved_login_domain:
                tenant.login_domain = resolved_login_domain
                tenant.save(update_fields=['login_domain', 'updated_at'])
            return tenant

        tenant = Tenant(
            schema_name=schema_name,
            name='Main Organization' if schema_name == DEFAULT_TENANT_SCHEMA else schema_name.replace('_', ' ').title(),
            slug=slug,
            login_domain=resolved_login_domain,
            is_active=True,
        )
        tenant.save()

        domain = internal_domain_for(schema_name)
        Domain.objects.create(domain=domain, tenant=tenant, is_primary=True)
        self.stdout.write(self.style.SUCCESS(
            f'Created tenant "{schema_name}" (login: *@{resolved_login_domain})'
        ))
        return tenant
