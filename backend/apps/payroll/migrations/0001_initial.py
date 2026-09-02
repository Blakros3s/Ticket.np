import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PayrollEmployeeCounter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_number', models.PositiveIntegerField(default=0)),
            ],
            options={
                'db_table': 'payroll_employee_counters',
            },
        ),
        migrations.CreateModel(
            name='PayrollEmployee',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('employee_code', models.CharField(max_length=20, unique=True)),
                ('full_name', models.CharField(max_length=200)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('address', models.TextField(blank=True)),
                ('role', models.CharField(choices=[('developer', 'Developer'), ('designer', 'Designer'), ('qa', 'QA'), ('manager', 'Manager'), ('office_staff', 'Office staff'), ('contractor', 'Contractor'), ('other', 'Other')], default='developer', max_length=30)),
                ('employment_type', models.CharField(choices=[('full_time', 'Full time'), ('part_time', 'Part time'), ('contract', 'Contract')], default='full_time', max_length=20)),
                ('pay_type', models.CharField(choices=[('monthly', 'Monthly'), ('hourly', 'Hourly')], default='monthly', max_length=20)),
                ('base_rate', models.DecimalField(decimal_places=2, max_digits=12)),
                ('date_of_joining', models.DateField(blank=True, null=True)),
                ('date_of_leaving', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive'), ('terminated', 'Terminated')], default='active', max_length=20)),
                ('bank_name', models.CharField(blank=True, max_length=120)),
                ('bank_account_number', models.CharField(blank=True, max_length=64)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payroll_employees_created', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'payroll_employees',
                'ordering': ['full_name'],
            },
        ),
        migrations.CreateModel(
            name='SalaryPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('period_year', models.PositiveSmallIntegerField()),
                ('period_month', models.PositiveSmallIntegerField()),
                ('payment_date', models.DateField()),
                ('base_amount', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('units_worked', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('allowances', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('overtime', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('bonus', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('deductions', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('gross_amount', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('net_amount', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12)),
                ('payment_method', models.CharField(choices=[('cash', 'Cash'), ('bank_transfer', 'Bank transfer'), ('cheque', 'Cheque'), ('qr', 'QR')], default='bank_transfer', max_length=20)),
                ('payment_status', models.CharField(choices=[('draft', 'Draft'), ('paid', 'Paid'), ('cancelled', 'Cancelled')], default='draft', max_length=20)),
                ('reference_number', models.CharField(blank=True, max_length=64)),
                ('notes', models.TextField(blank=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salary_payments_created', to=settings.AUTH_USER_MODEL)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='salary_payments', to='payroll.payrollemployee')),
            ],
            options={
                'db_table': 'salary_payments',
                'ordering': ['-period_year', '-period_month', 'employee__full_name'],
            },
        ),
        migrations.AddConstraint(
            model_name='salarypayment',
            constraint=models.UniqueConstraint(
                condition=models.Q(('payment_status__in', ['draft', 'paid'])),
                fields=('employee', 'period_year', 'period_month'),
                name='unique_active_salary_payment_per_period',
            ),
        ),
    ]
