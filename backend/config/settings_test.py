"""
Test settings for TicketHub project.
Uses SQLite for testing.
"""

from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
EMAIL_ENABLED = True
CELERY_TASK_ALWAYS_EAGER = True
FRONTEND_URL = 'http://testserver'
