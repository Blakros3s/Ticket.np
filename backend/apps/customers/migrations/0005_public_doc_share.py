import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0004_client_login_domain'),
    ]

    operations = [
        migrations.CreateModel(
            name='PublicDocShareIndex',
            fields=[
                ('token', models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ('tenant_schema', models.CharField(db_index=True, max_length=63)),
                ('doc_id', models.UUIDField()),
                ('is_active', models.BooleanField(default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'customers_public_doc_share_index',
            },
        ),
        migrations.CreateModel(
            name='PublicDocShareAccessLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('accessed_at', models.DateTimeField(auto_now_add=True)),
                ('share_index', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='access_logs', to='customers.publicdocshareindex')),
            ],
            options={
                'db_table': 'customers_public_doc_share_access_log',
                'ordering': ['-accessed_at'],
            },
        ),
    ]
