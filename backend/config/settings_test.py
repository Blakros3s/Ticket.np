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
