from django.core.management.base import BaseCommand
from django.db import transaction

from apps.projects.models import Project
from apps.tickets.models import Ticket, TicketIdCounter, format_ticket_id


class Command(BaseCommand):
    help = (
        'Renumber tickets per project (TKT-CODE-0001, TKT-CODE-0002, …) ordered by created_at. '
        'Run per tenant schema after migrate_schemas.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show planned changes without writing to the database.',
        )
        parser.add_argument(
            '--project-id',
            type=int,
            help='Only renumber tickets for a single project.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        project_id = options.get('project_id')

        projects = Project.objects.order_by('id')
        if project_id:
            projects = projects.filter(pk=project_id)

        if not projects.exists():
            self.stdout.write(self.style.WARNING('No matching projects found in this schema.'))
            return

        total_renumbered = 0

        for project in projects:
            tickets = list(
                Ticket.objects.filter(project=project).order_by('created_at', 'id')
            )
            if not tickets:
                continue

            self.stdout.write(f'Project {project.name} ({project.ticket_code}): {len(tickets)} ticket(s)')

            if dry_run:
                for index, ticket in enumerate(tickets, start=1):
                    new_id = format_ticket_id(project.ticket_code, index)
                    self.stdout.write(f'  {ticket.ticket_id} -> {new_id} (pk={ticket.pk})')
                total_renumbered += len(tickets)
                continue

            with transaction.atomic():
                for ticket in tickets:
                    ticket.ticket_id = f'__renumber_{ticket.pk}'
                Ticket.objects.bulk_update(tickets, ['ticket_id'])

                for index, ticket in enumerate(tickets, start=1):
                    ticket.ticket_id = format_ticket_id(project.ticket_code, index)
                Ticket.objects.bulk_update(tickets, ['ticket_id'])

                TicketIdCounter.objects.update_or_create(
                    project=project,
                    defaults={'last_number': len(tickets)},
                )

            total_renumbered += len(tickets)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Renumbered {len(tickets)} ticket(s). Next ticket will be '
                    f'{format_ticket_id(project.ticket_code, len(tickets) + 1)}.'
                )
            )

        if total_renumbered == 0:
            self.stdout.write(self.style.WARNING('No tickets found to renumber.'))
