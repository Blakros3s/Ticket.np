from django.core.management.base import BaseCommand
from django.db import transaction

from apps.tickets.models import Ticket, TicketIdCounter, format_ticket_number


class Command(BaseCommand):
    help = (
        'Renumber all tickets sequentially (TKT-0001, TKT-0002, …) ordered by created_at. '
        'Run per tenant schema after migrate_schemas.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show planned changes without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tickets = list(Ticket.objects.order_by('created_at', 'id'))

        if not tickets:
            self.stdout.write(self.style.WARNING('No tickets found in this schema.'))
            return

        self.stdout.write(f'Found {len(tickets)} ticket(s) to renumber.')

        if dry_run:
            for index, ticket in enumerate(tickets, start=1):
                new_id = format_ticket_number(index)
                self.stdout.write(f'  {ticket.ticket_id} -> {new_id} (pk={ticket.pk})')
            return

        with transaction.atomic():
            for ticket in tickets:
                ticket.ticket_id = f'__renumber_{ticket.pk}'
            Ticket.objects.bulk_update(tickets, ['ticket_id'])

            for index, ticket in enumerate(tickets, start=1):
                ticket.ticket_id = format_ticket_number(index)
            Ticket.objects.bulk_update(tickets, ['ticket_id'])

            TicketIdCounter.objects.update_or_create(
                pk=1,
                defaults={'last_number': len(tickets)},
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Renumbered {len(tickets)} ticket(s). Next ticket will be '
                f'{format_ticket_number(len(tickets) + 1)}.'
            )
        )
