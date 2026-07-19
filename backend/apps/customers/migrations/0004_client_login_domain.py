from django.db import migrations, models

from django_tenants.utils import get_public_schema_name, schema_context


def seed_login_domains_and_accounts(apps, schema_editor):
    Client = apps.get_model('customers', 'Client')
    TenantLoginAccount = apps.get_model('customers', 'TenantLoginAccount')
    User = apps.get_model('users', 'User')

    for client in Client.objects.exclude(schema_name='public'):
        if not client.login_domain or client.login_domain == 'local':
            client.login_domain = f'{client.slug}.local'
            client.save(update_fields=['login_domain'])

        with schema_context(client.schema_name):
            for user in User.objects.all().iterator():
                login_id = f'{user.username}@{client.login_domain}'.lower()
                TenantLoginAccount.objects.update_or_create(
                    client=client,
                    tenant_user_id=user.pk,
                    defaults={'username': login_id},
                )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0003_backfill_login_accounts'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='login_domain',
            field=models.CharField(
                default='local',
                help_text='Login postfix for tenant users, e.g. technest.com → user@technest.com',
                max_length=120,
            ),
            preserve_default=False,
        ),
        migrations.RunPython(seed_login_domains_and_accounts, migrations.RunPython.noop),
    ]
