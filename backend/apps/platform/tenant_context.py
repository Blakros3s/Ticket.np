from __future__ import annotations

from django.http import HttpRequest

from django_tenants.utils import get_public_schema_name, schema_context

SESSION_KEY = 'platform_admin_tenant_schema'


def persist_tenant_selection(request: HttpRequest, schema_name: str) -> None:
    request.session[SESSION_KEY] = schema_name


def clear_tenant_selection(request: HttpRequest) -> None:
    request.session.pop(SESSION_KEY, None)


def get_selected_tenant_schema(request: HttpRequest) -> str | None:
    if 'tenant' in request.GET:
        schema_name = request.GET.get('tenant', '').strip()
        if schema_name:
            persist_tenant_selection(request, schema_name)
            return schema_name
        clear_tenant_selection(request)
        return None
    return request.session.get(SESSION_KEY)


def get_selected_tenant(request: HttpRequest):
    from apps.customers.models import Client

    schema_name = get_selected_tenant_schema(request)
    if not schema_name:
        return None

    with schema_context(get_public_schema_name()):
        try:
            return Client.objects.get(schema_name=schema_name, is_active=True)
        except Client.DoesNotExist:
            clear_tenant_selection(request)
            return None


def get_active_tenants():
    from apps.customers.models import Client

    with schema_context(get_public_schema_name()):
        return list(Client.objects.filter(is_active=True).order_by('name'))
