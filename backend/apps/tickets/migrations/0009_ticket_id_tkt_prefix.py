from django.db import migrations

PREFIX = 'TKT-'
PAD_WIDTH = 4


def _format_ticket_number(number: int) -> str:
    return f'{PREFIX}{str(number).zfill(PAD_WIDTH)}'


def _parse_ticket_sequence(ticket_id: str | None) -> int | None:
    if not ticket_id:
        return None

    value = ticket_id.strip()
    if value.upper().startswith(PREFIX):
        suffix = value[len(PREFIX):]
        if suffix.isdigit():
            return int(suffix)

    if value.isdigit():
        return int(value)

    return None


def apply_tkt_ticket_id_prefix(apps, schema_editor):
    Ticket = apps.get_model('tickets', 'Ticket')
    TicketIdCounter = apps.get_model('tickets', 'TicketIdCounter')

    tickets = list(Ticket.objects.all().order_by('id'))
    if not tickets:
        return

    max_number = 0
    updates: list[tuple] = []

    for ticket in tickets:
        sequence = _parse_ticket_sequence(ticket.ticket_id)
        if sequence is None:
            continue

        max_number = max(max_number, sequence)
        normalized = _format_ticket_number(sequence)
        if ticket.ticket_id != normalized:
            updates.append((ticket, normalized))

    if not updates:
        TicketIdCounter.objects.update_or_create(pk=1, defaults={'last_number': max_number})
        return

    for ticket, _ in updates:
        ticket.ticket_id = f'__migrate_{ticket.pk}'
    Ticket.objects.bulk_update([ticket for ticket, _ in updates], ['ticket_id'])

    for ticket, normalized in updates:
        ticket.ticket_id = normalized
    Ticket.objects.bulk_update([ticket for ticket, _ in updates], ['ticket_id'])

    TicketIdCounter.objects.update_or_create(pk=1, defaults={'last_number': max_number})


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0008_ticket_module'),
    ]

    operations = [
        migrations.RunPython(apply_tkt_ticket_id_prefix, migrations.RunPython.noop),
    ]
