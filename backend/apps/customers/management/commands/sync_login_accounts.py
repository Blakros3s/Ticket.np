from django.core.management.base import BaseCommand
from django_tenants.utils import get_tenant_model

from apps.customers.services.login_accounts import resync_client_login_accounts

class Command(BaseCommand):
    help = 'Rebuild public-schema tenant login account index from all tenant users.'

    def handle(self, *args, **options):
        Client = get_tenant_model()
        total = 0

        for client in Client.objects.exclude(schema_name='public'):
            total += resync_client_login_accounts(client)

        self.stdout.write(self.style.SUCCESS(f'Synced {total} login account(s).'))
