#!/usr/bin/env python
"""Interactive wrapper — creates a platform server admin via manage.py createsuperuser."""

import os
import sys

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command


def main() -> None:
    call_command('createsuperuser')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        sys.stderr.write('\nOperation cancelled.\n')
        sys.exit(1)
