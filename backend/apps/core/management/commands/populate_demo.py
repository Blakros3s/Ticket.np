from django.core.management.base import BaseCommand

from apps.core.populate_demo import (
    DEFAULT_PASSWORD,
    build_demo_summary,
    run_populate_demo,
)


class Command(BaseCommand):
    help = (
        'Populate the canonical Technest Hub demo tenant with realistic data '
        '(users, projects, tickets in every status, history, todos, calendar).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Delete the demo tenant schema(s) before re-seeding',
        )
        parser.add_argument(
            '--password',
            default=DEFAULT_PASSWORD,
            help=f'Password for all seeded accounts (default: {DEFAULT_PASSWORD})',
        )
        parser.add_argument(
            '--include-legacy-flush',
            action='store_true',
            help='Also delete LEGACY_FLUSH_SCHEMAS when using --flush',
        )

    def handle(self, *args, **options):
        password = options['password']
        ctx = run_populate_demo(
            password=password,
            flush=options['flush'],
            include_legacy_flush=options['include_legacy_flush'],
        )
        self.stdout.write(self.style.SUCCESS(build_demo_summary(ctx, password)))
