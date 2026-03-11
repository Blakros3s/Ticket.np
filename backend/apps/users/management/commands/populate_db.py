from django.core.management.base import BaseCommand

from populate import main


class Command(BaseCommand):
    help = 'Populate TicketHub with realistic dummy data. Use --clear to wipe existing data first.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing data (except admin) before populating',
        )

    def handle(self, *args, **options):
        main(clear=options['clear'])
