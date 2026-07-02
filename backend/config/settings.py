"""
Django settings for TicketHub project.
"""

import os
from pathlib import Path
from datetime import timedelta
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-this-in-production')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOW_PUBLIC_REGISTRATION = config('ALLOW_PUBLIC_REGISTRATION', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'django_filters',
    'rest_framework_simplejwt.token_blacklist',
    
    'apps.users',
    'apps.projects',
    'apps.tickets',
    'apps.timelogs',
    'apps.comments',
    'apps.activity',
    'apps.dashboard',
    'apps.calendar',
    'apps.todos',
    'apps.core',
    'apps.attendance',
    'apps.notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.core.middleware.RateLimitMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST', default='db'),
        'PORT': config('POSTGRES_PORT', default='5432'),
        'ATOMIC_REQUESTS': True,
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Kathmandu'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

JWT_ACCESS_TOKEN_LIFETIME_MINUTES = config('JWT_ACCESS_TOKEN_LIFETIME', default=60, cast=int)
JWT_REFRESH_TOKEN_LIFETIME_MINUTES = config('JWT_REFRESH_TOKEN_LIFETIME', default=43200, cast=int)  # 30 days

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=JWT_ACCESS_TOKEN_LIFETIME_MINUTES),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=JWT_REFRESH_TOKEN_LIFETIME_MINUTES),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000,http://localhost:3001').split(',')
CORS_ALLOW_CREDENTIALS = True

SPECTACULAR_SETTINGS = {
    'TITLE': 'TicketHub API',
    'DESCRIPTION': 'Simple project-based ticket management system',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="",
    cast=lambda v: [s.strip() for s in v.split(",") if s]
)
# Security Settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

# Rate Limiting
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = 'default'
DEFAULT_RATE_LIMIT = '100/minute'
AUTH_RATE_LIMIT = '10/minute'

# Frontend + public website (Technest-style links in HTML emails)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
WEBSITE_URL = config('WEBSITE_URL', default='https://technestinnovations.com.np')

# Mail — Technest-style: file/console in dev, SMTP when credentials are set.
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='').strip()
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='').strip()
_use_tls_raw = config('EMAIL_USE_TLS', default='').strip()
if not _use_tls_raw:
    _use_tls_raw = config('EMAIL_TLS', default='true')
EMAIL_USE_TLS = str(_use_tls_raw).lower() in ('true', '1', 'yes')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='').strip()
SERVER_EMAIL = config('SERVER_EMAIL', default=DEFAULT_FROM_EMAIL or '').strip()
EMAIL_USE_SMTP_IN_DEBUG = config('EMAIL_USE_SMTP_IN_DEBUG', default=False, cast=bool)

_email_credentials_complete = bool(
    EMAIL_HOST_USER and EMAIL_HOST_PASSWORD and DEFAULT_FROM_EMAIL
)
if os.environ.get('EMAIL_ENABLED') is not None:
    EMAIL_ENABLED = config('EMAIL_ENABLED', cast=bool)
else:
    EMAIL_ENABLED = _email_credentials_complete

_email_backend_override = config('EMAIL_BACKEND', default='').strip()
_email_file_path = config('EMAIL_FILE_PATH', default='').strip()

if _email_backend_override:
    EMAIL_BACKEND = _email_backend_override
elif _email_file_path:
    EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend'
    EMAIL_FILE_PATH = str(BASE_DIR / _email_file_path.strip().lstrip('/\\'))
    Path(EMAIL_FILE_PATH).mkdir(parents=True, exist_ok=True)
elif _email_credentials_complete and (not DEBUG or EMAIL_USE_SMTP_IN_DEBUG):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
elif DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
elif _email_credentials_complete:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.dummy.EmailBackend'

# Celery — disabled by default; set CELERY_BROKER_URL to use Redis + worker.
# Without a broker, tasks run inline (CELERY_TASK_ALWAYS_EAGER=True).
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='').strip()
CELERY_ENABLED = bool(CELERY_BROKER_URL)

if CELERY_ENABLED:
    CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=CELERY_BROKER_URL)
else:
    CELERY_RESULT_BACKEND = None

if os.environ.get('CELERY_TASK_ALWAYS_EAGER') is not None:
    CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', cast=bool)
else:
    CELERY_TASK_ALWAYS_EAGER = not CELERY_ENABLED

CELERY_TASK_TRACK_STARTED = True
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
