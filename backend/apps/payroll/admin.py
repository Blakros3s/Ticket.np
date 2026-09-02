from django.contrib import admin

from apps.payroll.models import PayrollEmployee, SalaryPayment


@admin.register(PayrollEmployee)
class PayrollEmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_code', 'full_name', 'role', 'pay_type', 'base_rate', 'status')
    list_filter = ('status', 'role', 'pay_type', 'employment_type')
    search_fields = ('employee_code', 'full_name', 'phone', 'email')
    readonly_fields = ('employee_code', 'created_at', 'updated_at')


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = (
        'employee',
        'period_year',
        'period_month',
        'net_amount',
        'payment_status',
        'payment_date',
    )
    list_filter = ('payment_status', 'payment_method', 'period_year', 'period_month')
    search_fields = ('employee__full_name', 'employee__employee_code', 'reference_number')
    readonly_fields = ('gross_amount', 'net_amount', 'paid_at', 'created_at', 'updated_at')
