from django.db import transaction

from apps.payroll.models import PayrollEmployeeCounter

EMPLOYEE_CODE_PREFIX = 'EMP-'
EMPLOYEE_CODE_PAD_WIDTH = 4


def format_employee_code(number: int) -> str:
    return f'{EMPLOYEE_CODE_PREFIX}{str(number).zfill(EMPLOYEE_CODE_PAD_WIDTH)}'


def allocate_next_employee_code() -> str:
    with transaction.atomic():
        counter, _ = PayrollEmployeeCounter.objects.select_for_update().get_or_create(
            pk=1,
            defaults={'last_number': 0},
        )
        counter.last_number += 1
        counter.save(update_fields=['last_number'])
        return format_employee_code(counter.last_number)
