from django.db import migrations
from django_tenants.utils import schema_context


def backfill_login_accounts(apps, schema_editor):
    TenantLoginAccount = apps.get_model('customers', 'TenantLoginAccount')
    User = apps.get_model('users', 'User')
    # Use the historical model — get_tenant_model() returns the live Client
    # which may include fields not yet added to the database (e.g. login_domain).
    Client = apps.get_model('customers', 'Client')

    for client in Client.objects.exclude(schema_name='public'):
        with schema_context(client.schema_name):
            for user in User.objects.all().iterator():
                TenantLoginAccount.objects.update_or_create(
                    username=user.username,
                    defaults={
                        'client_id': client.pk,
                        'tenant_user_id': user.pk,
                    },
                )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0002_tenant_login_account'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill_login_accounts, migrations.RunPython.noop),
    ]
