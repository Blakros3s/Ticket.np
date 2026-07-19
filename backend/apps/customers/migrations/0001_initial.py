import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Client',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('schema_name', models.CharField(db_index=True, max_length=63, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('slug', models.SlugField(max_length=64, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'customers_client',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=60, unique=True)),
                ('tier', models.CharField(choices=[('standard', 'Standard'), ('premium', 'Premium')], db_index=True, max_length=20)),
                ('monthly_price', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('max_users', models.PositiveIntegerField(default=25)),
                ('max_projects', models.PositiveIntegerField(default=10)),
                ('attendance_enabled', models.BooleanField(default=True)),
                ('calendar_enabled', models.BooleanField(default=True)),
                ('email_notifications_enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'customers_plan',
                'ordering': ['monthly_price'],
            },
        ),
        migrations.CreateModel(
            name='Domain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(db_index=True, max_length=253, unique=True)),
                ('is_primary', models.BooleanField(db_index=True, default=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='customers.client')),
            ],
            options={
                'db_table': 'customers_domain',
            },
        ),
        migrations.CreateModel(
            name='TenantSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('active', 'Active'), ('expired', 'Expired'), ('cancelled', 'Cancelled')], default='active', max_length=20)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('client', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to='customers.client')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='subscriptions', to='customers.plan')),
            ],
            options={
                'db_table': 'customers_tenant_subscription',
            },
        ),
    ]
