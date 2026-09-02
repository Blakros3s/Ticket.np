from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.payroll.models import PayrollEmployee, SalaryPayment
from apps.payroll.services.codes import format_employee_code
from apps.users.models import User


class PayrollAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='payroll_admin',
            email='payroll_admin@test.com',
            password='adminpass123',
            role='admin',
        )
        self.employee_user = User.objects.create_user(
            username='payroll_employee',
            email='payroll_employee@test.com',
            password='employeepass123',
            role='employee',
        )
        self.client.force_authenticate(user=self.admin)

    def test_non_admin_cannot_access_payroll(self):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get('/api/payroll/employees/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_employee_assigns_code(self):
        response = self.client.post(
            '/api/payroll/employees/',
            {
                'full_name': 'Jane Developer',
                'role': PayrollEmployee.ROLE_DEVELOPER,
                'employment_type': PayrollEmployee.EMPLOYMENT_FULL_TIME,
                'pay_type': PayrollEmployee.PAY_TYPE_MONTHLY,
                'base_rate': '75000.00',
                'status': PayrollEmployee.STATUS_ACTIVE,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['employee_code'], format_employee_code(1))
        self.assertEqual(response.data['full_name'], 'Jane Developer')

    def test_bulk_pay_monthly_employee(self):
        employee = PayrollEmployee.objects.create(
            employee_code=format_employee_code(1),
            full_name='Monthly Dev',
            role=PayrollEmployee.ROLE_DEVELOPER,
            pay_type=PayrollEmployee.PAY_TYPE_MONTHLY,
            base_rate=Decimal('50000.00'),
            created_by=self.admin,
        )
        today = timezone.localdate()
        response = self.client.post(
            '/api/payroll/payments/bulk-pay/',
            {
                'period_year': today.year,
                'period_month': today.month,
                'payment_date': today.isoformat(),
                'payment_method': SalaryPayment.METHOD_BANK_TRANSFER,
                'mark_paid': True,
                'rows': [{'employee_id': employee.id}],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['payment_status'], SalaryPayment.STATUS_PAID)
        self.assertEqual(Decimal(response.data[0]['net_amount']), Decimal('50000.00'))

    def test_duplicate_period_payment_rejected(self):
        employee = PayrollEmployee.objects.create(
            employee_code=format_employee_code(1),
            full_name='Duplicate Dev',
            role=PayrollEmployee.ROLE_DEVELOPER,
            pay_type=PayrollEmployee.PAY_TYPE_MONTHLY,
            base_rate=Decimal('40000.00'),
            created_by=self.admin,
        )
        today = timezone.localdate()
        payload = {
            'employee': employee.id,
            'period_year': today.year,
            'period_month': today.month,
            'payment_date': today.isoformat(),
            'payment_method': SalaryPayment.METHOD_BANK_TRANSFER,
        }
        first = self.client.post('/api/payroll/payments/', payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post('/api/payroll/payments/', payload, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deactivate_employee_with_payments(self):
        employee = PayrollEmployee.objects.create(
            employee_code=format_employee_code(1),
            full_name='Protected Dev',
            role=PayrollEmployee.ROLE_DEVELOPER,
            pay_type=PayrollEmployee.PAY_TYPE_MONTHLY,
            base_rate=Decimal('30000.00'),
            created_by=self.admin,
        )
        today = timezone.localdate()
        SalaryPayment.objects.create(
            employee=employee,
            period_year=today.year,
            period_month=today.month,
            payment_date=today,
            base_amount=Decimal('30000.00'),
            gross_amount=Decimal('30000.00'),
            net_amount=Decimal('30000.00'),
            created_by=self.admin,
        )

        response = self.client.delete(f'/api/payroll/employees/{employee.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        employee.refresh_from_db()
        self.assertEqual(employee.status, PayrollEmployee.STATUS_INACTIVE)
        self.assertTrue(SalaryPayment.objects.filter(employee=employee).exists())
