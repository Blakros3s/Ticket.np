from __future__ import annotations

import os
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django_tenants.utils import get_tenant_model, schema_context

from apps.core.media_paths import tenant_scoped_upload_path
from apps.projects.models import ProjectDocument
from apps.tickets.models import TicketMedia


class Command(BaseCommand):
    help = 'Move legacy media files into tenant-scoped directories ({schema}/ticket_media/...).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schema',
            default='',
            help='Only migrate a single tenant schema (default: all tenants)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show planned moves without changing files or database rows',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        schema_filter = options['schema'].strip()
        media_root = settings.MEDIA_ROOT

        tenants = get_tenant_model().objects.all()
        if schema_filter:
            tenants = tenants.filter(schema_name=schema_filter)

        total_moved = 0
        total_skipped = 0

        for tenant in tenants:
            if tenant.schema_name == 'public':
                continue

            with schema_context(tenant.schema_name):
                moved, skipped = self._migrate_schema(
                    media_root=media_root,
                    schema_name=tenant.schema_name,
                    dry_run=dry_run,
                )
                total_moved += moved
                total_skipped += skipped
                self.stdout.write(
                    f'{tenant.schema_name}: moved={moved}, skipped={skipped}'
                )

        prefix = '[dry-run] ' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'{prefix}Media migration complete. moved={total_moved}, skipped={total_skipped}'
        ))

    def _migrate_schema(self, *, media_root, schema_name: str, dry_run: bool) -> tuple[int, int]:
        moved = 0
        skipped = 0

        for model in (TicketMedia, ProjectDocument):
            for instance in model.objects.exclude(file='').iterator():
                current_name = instance.file.name
                if not current_name or current_name.startswith(f'{schema_name}/'):
                    skipped += 1
                    continue

                new_name = tenant_scoped_upload_path(current_name)
                if new_name == current_name:
                    skipped += 1
                    continue

                old_path = os.path.join(media_root, current_name)
                new_path = os.path.join(media_root, new_name)

                if dry_run:
                    self.stdout.write(f'  {current_name} -> {new_name}')
                    moved += 1
                    continue

                if not os.path.isfile(old_path):
                    self.stderr.write(self.style.WARNING(
                        f'  missing file for {current_name}; updating DB path only'
                    ))

                os.makedirs(os.path.dirname(new_path), exist_ok=True)

                if os.path.isfile(old_path):
                    if os.path.exists(new_path):
                        raise RuntimeError(f'Target already exists: {new_path}')
                    shutil.move(old_path, new_path)

                with transaction.atomic():
                    instance.file.name = new_name
                    instance.save(update_fields=['file'])

                moved += 1

        return moved, skipped
