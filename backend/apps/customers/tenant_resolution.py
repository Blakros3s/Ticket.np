"""Resolve tenants by slug/schema — same API domain for all organizations."""

from __future__ import annotations

from django.conf import settings
from django.db import connection
from django.http import Http404
from django_tenants.utils import get_public_schema_name, get_tenant_model, schema_context


def resolve_tenant(identifier: str):
    """Look up an active tenant by slug or schema_name (always queries public schema)."""
    key = (identifier or '').strip().lower()
    if not key:
        return None

    Tenant = get_tenant_model()
    with schema_context(get_public_schema_name()):
        tenant = Tenant.objects.filter(slug=key, is_active=True).first()
        if tenant is None:
            tenant = Tenant.objects.filter(schema_name=key, is_active=True).first()
    return tenant


def is_public_api_path(path: str) -> bool:
    path = path or ''
    if path.startswith('/api/server/'):
        return True
    if path in ('/api/health/', '/health/'):
        return True
    return False


def is_tenant_login_path(path: str, method: str) -> bool:
    return method == 'POST' and path.rstrip('/') == '/api/auth/login'


def set_public_schema() -> None:
    connection.set_schema_to_public()


def set_tenant(tenant) -> None:
    connection.set_tenant(tenant)


def internal_domain_for(schema_name: str) -> str:
    """Placeholder domain for django-tenants — not used for HTTP routing."""
    return f'{schema_name}.internal'


def shared_app_domain() -> str:
    return getattr(settings, 'SHARED_APP_DOMAIN', 'localhost')
