from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activity.utils import log_activity
from apps.payroll.models import PayrollEmployee, SalaryPayment
from apps.payroll.services.calculations import compute_base_amount, compute_payment_amounts


def refresh_payment_amounts(payment: SalaryPayment) -> None:
    payment.recalculate_amounts()


def mark_payment_paid(payment: SalaryPayment, *, user) -> SalaryPayment:
    if payment.payment_status == SalaryPayment.STATUS_PAID:
        return payment
    if payment.payment_status == SalaryPayment.STATUS_CANCELLED:
        raise ValidationError('Cancelled payments cannot be marked paid.')

    refresh_payment_amounts(payment)
    payment.payment_status = SalaryPayment.STATUS_PAID
    payment.paid_at = timezone.now()
    payment.save()

    log_activity(
        action='update',
        user=user,
        instance=payment,
        description=(
            f"Marked salary paid for {payment.employee.full_name} "
            f"({payment.period_year}-{payment.period_month:02d})"
        ),
        extra_data={'net_amount': str(payment.net_amount)},
    )
    return payment


def cancel_payment(payment: SalaryPayment, *, user) -> SalaryPayment:
    if payment.payment_status == SalaryPayment.STATUS_CANCELLED:
        return payment

    payment.payment_status = SalaryPayment.STATUS_CANCELLED
    payment.paid_at = None
    payment.save(update_fields=['payment_status', 'paid_at', 'updated_at'])

    log_activity(
        action='update',
        user=user,
        instance=payment,
        description=(
            f"Cancelled salary payment for {payment.employee.full_name} "
            f"({payment.period_year}-{payment.period_month:02d})"
        ),
    )
    return payment


@transaction.atomic
def bulk_pay(
    *,
    user,
    period_year: int,
    period_month: int,
    payment_date,
    payment_method: str,
    rows: list[dict],
    mark_paid: bool,
) -> list[SalaryPayment]:
    results: list[SalaryPayment] = []

    for row in rows:
        employee_id = row['employee_id']
        try:
            employee = PayrollEmployee.objects.get(pk=employee_id, status=PayrollEmployee.STATUS_ACTIVE)
        except PayrollEmployee.DoesNotExist as exc:
            raise ValidationError(f'Active payroll employee {employee_id} not found.') from exc

        existing = SalaryPayment.objects.filter(
            employee=employee,
            period_year=period_year,
            period_month=period_month,
        ).exclude(payment_status=SalaryPayment.STATUS_CANCELLED).first()

        units_worked = row.get('units_worked')
        base_amount = compute_base_amount(
            pay_type=employee.pay_type,
            base_rate=employee.base_rate,
            units_worked=units_worked,
        )
        _, gross_amount, net_amount = compute_payment_amounts(
            base_amount=base_amount,
            allowances=row.get('allowances', 0),
            overtime=row.get('overtime', 0),
            bonus=row.get('bonus', 0),
            deductions=row.get('deductions', 0),
        )

        if existing:
            if existing.payment_status == SalaryPayment.STATUS_PAID:
                raise ValidationError(
                    f'{employee.full_name} already has a paid salary for this period.'
                )
            payment = existing
            payment.payment_date = payment_date
            payment.payment_method = payment_method
            payment.units_worked = units_worked
            payment.base_amount = base_amount
            payment.allowances = row.get('allowances', 0)
            payment.overtime = row.get('overtime', 0)
            payment.bonus = row.get('bonus', 0)
            payment.deductions = row.get('deductions', 0)
            payment.gross_amount = gross_amount
            payment.net_amount = net_amount
            payment.notes = row.get('notes', '')
            payment.save()
        else:
            payment = SalaryPayment.objects.create(
                employee=employee,
                period_year=period_year,
                period_month=period_month,
                payment_date=payment_date,
                payment_method=payment_method,
                units_worked=units_worked,
                base_amount=base_amount,
                allowances=row.get('allowances', 0),
                overtime=row.get('overtime', 0),
                bonus=row.get('bonus', 0),
                deductions=row.get('deductions', 0),
                gross_amount=gross_amount,
                net_amount=net_amount,
                payment_status=SalaryPayment.STATUS_DRAFT,
                notes=row.get('notes', ''),
                created_by=user,
            )

        if mark_paid:
            mark_payment_paid(payment, user=user)
        results.append(payment)

    return results
