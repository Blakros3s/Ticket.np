import csv
from decimal import Decimal

from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activity.utils import log_activity
from apps.payroll.models import PayrollEmployee, SalaryPayment
from apps.payroll.serializers import (
    BulkPaySerializer,
    PayrollEmployeeCreateSerializer,
    PayrollEmployeeSerializer,
    SalaryPaymentCreateSerializer,
    SalaryPaymentSerializer,
)
from apps.payroll.services.calculations import compute_base_amount, compute_payment_amounts
from apps.payroll.services.payments import bulk_pay, cancel_payment, mark_payment_paid
from apps.users.permissions import IsAdminUser


def _decimal_str(value) -> str:
    return str(value or Decimal('0'))


@extend_schema(tags=['Payroll'])
@extend_schema_view(
    list=extend_schema(summary='List payroll employees'),
    create=extend_schema(summary='Create payroll employee'),
    retrieve=extend_schema(summary='Get payroll employee'),
    partial_update=extend_schema(summary='Update payroll employee'),
    destroy=extend_schema(summary='Deactivate or delete payroll employee'),
)
class PayrollEmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'role', 'pay_type', 'employment_type']
    search_fields = ['full_name', 'employee_code', 'phone', 'email']
    ordering_fields = ['full_name', 'employee_code', 'created_at', 'base_rate']
    ordering = ['full_name']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return PayrollEmployee.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return PayrollEmployeeCreateSerializer
        return PayrollEmployeeSerializer

    def perform_destroy(self, instance: PayrollEmployee):
        if instance.salary_payments.exists():
            instance.status = PayrollEmployee.STATUS_INACTIVE
            instance.save(update_fields=['status', 'updated_at'])
            log_activity(
                action='update',
                user=self.request.user,
                instance=instance,
                description=f'Deactivated payroll employee {instance.full_name}',
            )
            return
        instance.delete()

    @extend_schema(summary='Payroll employee summary')
    @action(detail=False, methods=['get'])
    def summary(self, request):
        queryset = PayrollEmployee.objects.all()
        active = queryset.filter(status=PayrollEmployee.STATUS_ACTIVE)
        monthly_liability = sum(
            (employee.base_rate for employee in active if employee.pay_type == PayrollEmployee.PAY_TYPE_MONTHLY),
            Decimal('0'),
        )
        return Response({
            'total_count': queryset.count(),
            'active_count': active.count(),
            'inactive_count': queryset.filter(status=PayrollEmployee.STATUS_INACTIVE).count(),
            'terminated_count': queryset.filter(status=PayrollEmployee.STATUS_TERMINATED).count(),
            'estimated_monthly_liability': _decimal_str(monthly_liability),
        })


@extend_schema(tags=['Payroll'])
@extend_schema_view(
    list=extend_schema(summary='List salary payments'),
    create=extend_schema(summary='Create salary payment'),
    retrieve=extend_schema(summary='Get salary payment'),
    partial_update=extend_schema(summary='Update salary payment'),
)
class SalaryPaymentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = None
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['payment_status', 'payment_method', 'period_year', 'period_month', 'employee']
    ordering_fields = ['payment_date', 'period_year', 'period_month', 'net_amount', 'created_at']
    ordering = ['-period_year', '-period_month', '-created_at']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return SalaryPayment.objects.select_related('employee')

    def get_serializer_class(self):
        if self.action == 'create':
            return SalaryPaymentCreateSerializer
        return SalaryPaymentSerializer

    def perform_update(self, serializer):
        payment = serializer.instance
        if payment.payment_status == SalaryPayment.STATUS_PAID:
            raise ValidationError('Paid payments cannot be edited.')
        if payment.payment_status == SalaryPayment.STATUS_CANCELLED:
            raise ValidationError('Cancelled payments cannot be edited.')
        serializer.save()

    @extend_schema(summary='Mark payment as paid')
    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        payment = self.get_object()
        payment = mark_payment_paid(payment, user=request.user)
        return Response(SalaryPaymentSerializer(payment).data)

    @extend_schema(summary='Cancel payment')
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        payment = self.get_object()
        payment = cancel_payment(payment, user=request.user)
        return Response(SalaryPaymentSerializer(payment).data)

    @extend_schema(summary='Pay run grid for a period')
    @action(detail=False, methods=['get'], url_path='period-status')
    def period_status(self, request):
        try:
            period_year = int(request.query_params.get('year', ''))
            period_month = int(request.query_params.get('month', ''))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Query params year and month are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employees = PayrollEmployee.objects.filter(status=PayrollEmployee.STATUS_ACTIVE).order_by('full_name')
        payments = {
            payment.employee_id: payment
            for payment in SalaryPayment.objects.filter(
                period_year=period_year,
                period_month=period_month,
            ).exclude(payment_status=SalaryPayment.STATUS_CANCELLED)
        }

        rows = []
        for employee in employees:
            payment = payments.get(employee.id)
            units_worked = payment.units_worked if payment else None
            base_amount = payment.base_amount if payment else compute_base_amount(
                pay_type=employee.pay_type,
                base_rate=employee.base_rate,
                units_worked=units_worked,
            )
            allowances = payment.allowances if payment else Decimal('0')
            overtime = payment.overtime if payment else Decimal('0')
            bonus = payment.bonus if payment else Decimal('0')
            deductions = payment.deductions if payment else Decimal('0')
            _, gross_amount, net_amount = compute_payment_amounts(
                base_amount=base_amount,
                allowances=allowances,
                overtime=overtime,
                bonus=bonus,
                deductions=deductions,
            )
            rows.append({
                'employee': PayrollEmployeeSerializer(employee).data,
                'payment_id': payment.id if payment else None,
                'payment_status': payment.payment_status if payment else None,
                'units_worked': _decimal_str(units_worked) if units_worked is not None else None,
                'base_amount': _decimal_str(base_amount),
                'allowances': _decimal_str(allowances),
                'overtime': _decimal_str(overtime),
                'bonus': _decimal_str(bonus),
                'deductions': _decimal_str(deductions),
                'gross_amount': _decimal_str(gross_amount),
                'net_amount': _decimal_str(net_amount),
                'notes': payment.notes if payment else '',
            })

        return Response({
            'period_year': period_year,
            'period_month': period_month,
            'rows': rows,
        })

    @extend_schema(summary='Bulk pay run')
    @action(detail=False, methods=['post'], url_path='bulk-pay')
    def bulk_pay_action(self, request):
        serializer = BulkPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        payments = bulk_pay(
            user=request.user,
            period_year=data['period_year'],
            period_month=data['period_month'],
            payment_date=data['payment_date'],
            payment_method=data['payment_method'],
            rows=data['rows'],
            mark_paid=data['mark_paid'],
        )
        return Response(
            SalaryPaymentSerializer(payments, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary='Payment summary')
    @action(detail=False, methods=['get'])
    def summary(self, request):
        now = timezone.localdate()
        period_year = int(request.query_params.get('year', now.year))
        period_month = int(request.query_params.get('month', now.month))

        period_qs = SalaryPayment.objects.filter(
            period_year=period_year,
            period_month=period_month,
        ).exclude(payment_status=SalaryPayment.STATUS_CANCELLED)

        paid_qs = period_qs.filter(payment_status=SalaryPayment.STATUS_PAID)
        draft_qs = period_qs.filter(payment_status=SalaryPayment.STATUS_DRAFT)

        return Response({
            'period_year': period_year,
            'period_month': period_month,
            'draft_count': draft_qs.count(),
            'paid_count': paid_qs.count(),
            'draft_total_net': _decimal_str(draft_qs.aggregate(total=Sum('net_amount'))['total']),
            'paid_total_net': _decimal_str(paid_qs.aggregate(total=Sum('net_amount'))['total']),
            'all_time_paid_total_net': _decimal_str(
                SalaryPayment.objects.filter(payment_status=SalaryPayment.STATUS_PAID).aggregate(
                    total=Sum('net_amount')
                )['total']
            ),
        })

    @extend_schema(summary='Export paid payments as CSV')
    @action(detail=False, methods=['get'])
    def export(self, request):
        try:
            period_year = int(request.query_params.get('year', ''))
            period_month = int(request.query_params.get('month', ''))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Query params year and month are required integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payments = SalaryPayment.objects.filter(
            period_year=period_year,
            period_month=period_month,
            payment_status=SalaryPayment.STATUS_PAID,
        ).select_related('employee').order_by('employee__full_name')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="payroll_{period_year}_{period_month:02d}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            'Employee Code',
            'Employee Name',
            'Period',
            'Payment Date',
            'Base Amount',
            'Allowances',
            'Overtime',
            'Bonus',
            'Deductions',
            'Gross Amount',
            'Net Amount',
            'Payment Method',
            'Reference Number',
            'Bank Name',
            'Bank Account Number',
        ])
        for payment in payments:
            employee = payment.employee
            writer.writerow([
                employee.employee_code,
                employee.full_name,
                f'{payment.period_year}-{payment.period_month:02d}',
                payment.payment_date.isoformat(),
                payment.base_amount,
                payment.allowances,
                payment.overtime,
                payment.bonus,
                payment.deductions,
                payment.gross_amount,
                payment.net_amount,
                payment.get_payment_method_display(),
                payment.reference_number,
                employee.bank_name,
                employee.bank_account_number,
            ])
        return response
