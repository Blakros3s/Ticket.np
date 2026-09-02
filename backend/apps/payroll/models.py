from decimal import Decimal

from django.db import models
from django.db.models import Q

from apps.users.models import User
from apps.payroll.services.calculations import compute_base_amount, compute_payment_amounts


class PayrollEmployeeCounter(models.Model):
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'payroll_employee_counters'


class PayrollEmployee(models.Model):
    ROLE_DEVELOPER = 'developer'
    ROLE_DESIGNER = 'designer'
    ROLE_QA = 'qa'
    ROLE_MANAGER = 'manager'
    ROLE_OFFICE_STAFF = 'office_staff'
    ROLE_CONTRACTOR = 'contractor'
    ROLE_OTHER = 'other'
    ROLE_CHOICES = [
        (ROLE_DEVELOPER, 'Developer'),
        (ROLE_DESIGNER, 'Designer'),
        (ROLE_QA, 'QA'),
        (ROLE_MANAGER, 'Manager'),
        (ROLE_OFFICE_STAFF, 'Office staff'),
        (ROLE_CONTRACTOR, 'Contractor'),
        (ROLE_OTHER, 'Other'),
    ]

    EMPLOYMENT_FULL_TIME = 'full_time'
    EMPLOYMENT_PART_TIME = 'part_time'
    EMPLOYMENT_CONTRACT = 'contract'
    EMPLOYMENT_TYPE_CHOICES = [
        (EMPLOYMENT_FULL_TIME, 'Full time'),
        (EMPLOYMENT_PART_TIME, 'Part time'),
        (EMPLOYMENT_CONTRACT, 'Contract'),
    ]

    PAY_TYPE_MONTHLY = 'monthly'
    PAY_TYPE_HOURLY = 'hourly'
    PAY_TYPE_CHOICES = [
        (PAY_TYPE_MONTHLY, 'Monthly'),
        (PAY_TYPE_HOURLY, 'Hourly'),
    ]

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_TERMINATED = 'terminated'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_TERMINATED, 'Terminated'),
    ]

    employee_code = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default=ROLE_DEVELOPER)
    employment_type = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_TYPE_CHOICES,
        default=EMPLOYMENT_FULL_TIME,
    )
    pay_type = models.CharField(max_length=20, choices=PAY_TYPE_CHOICES, default=PAY_TYPE_MONTHLY)
    base_rate = models.DecimalField(max_digits=12, decimal_places=2)
    date_of_joining = models.DateField(null=True, blank=True)
    date_of_leaving = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_account_number = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payroll_employees_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_employees'
        ordering = ['full_name']

    def __str__(self):
        return f'{self.employee_code} — {self.full_name}'


class SalaryPayment(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PAID = 'paid'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PAID, 'Paid'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    METHOD_CASH = 'cash'
    METHOD_BANK_TRANSFER = 'bank_transfer'
    METHOD_CHEQUE = 'cheque'
    METHOD_QR = 'qr'
    PAYMENT_METHOD_CHOICES = [
        (METHOD_CASH, 'Cash'),
        (METHOD_BANK_TRANSFER, 'Bank transfer'),
        (METHOD_CHEQUE, 'Cheque'),
        (METHOD_QR, 'QR'),
    ]

    employee = models.ForeignKey(
        PayrollEmployee,
        on_delete=models.PROTECT,
        related_name='salary_payments',
    )
    period_year = models.PositiveSmallIntegerField()
    period_month = models.PositiveSmallIntegerField()
    payment_date = models.DateField()
    base_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    units_worked = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    overtime = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default=METHOD_BANK_TRANSFER)
    payment_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    reference_number = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='salary_payments_created',
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'salary_payments'
        ordering = ['-period_year', '-period_month', 'employee__full_name']
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'period_year', 'period_month'],
                condition=Q(payment_status__in=['draft', 'paid']),
                name='unique_active_salary_payment_per_period',
            ),
        ]

    def __str__(self):
        return (
            f'{self.employee.full_name} {self.period_year}-{self.period_month:02d} '
            f'({self.payment_status})'
        )

    def recalculate_amounts(self) -> None:
        if self.base_amount is None or self.base_amount == Decimal('0'):
            self.base_amount = compute_base_amount(
                pay_type=self.employee.pay_type,
                base_rate=self.employee.base_rate,
                units_worked=self.units_worked,
            )
        _, gross, net = compute_payment_amounts(
            base_amount=self.base_amount,
            allowances=self.allowances,
            overtime=self.overtime,
            bonus=self.bonus,
            deductions=self.deductions,
        )
        self.gross_amount = gross
        self.net_amount = net

    def save(self, *args, **kwargs):
        self.recalculate_amounts()
        super().save(*args, **kwargs)
