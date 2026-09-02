from decimal import Decimal


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def compute_base_amount(*, pay_type: str, base_rate, units_worked=None) -> Decimal:
    rate = to_decimal(base_rate)
    if pay_type == 'monthly':
        return rate
    units = to_decimal(units_worked)
    return rate * units


def compute_payment_amounts(
    *,
    base_amount,
    allowances=0,
    overtime=0,
    bonus=0,
    deductions=0,
) -> tuple[Decimal, Decimal, Decimal]:
    base = to_decimal(base_amount)
    gross = base + to_decimal(allowances) + to_decimal(overtime) + to_decimal(bonus)
    net = gross - to_decimal(deductions)
    if net < 0:
        net = Decimal('0')
    return base, gross, net
