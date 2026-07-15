"""
Test settings for TicketHub project.
Uses PostgreSQL with django-tenants (same engine as production).
"""

import os

os.environ.setdefault('POSTGRES_DB', 'test_tickethub')
os.environ.setdefault('POSTGRES_USER', 'postgres')
os.environ.setdefault('POSTGRES_PASSWORD', 'postgres')
os.environ.setdefault('POSTGRES_HOST', 'localhost')
os.environ.setdefault('SHOW_PUBLIC_IF_NO_TENANT_FOUND', 'true')

from .settings import *  # noqa: F401,F403

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
EMAIL_ENABLED = True
CELERY_TASK_ALWAYS_EAGER = True
FRONTEND_URL = 'http://testserver'
