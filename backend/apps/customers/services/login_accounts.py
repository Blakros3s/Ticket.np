from __future__ import annotations

import re

from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import Client, TenantLoginAccount
from apps.users.models import User

LOGIN_DOMAIN_RE = re.compile(r'^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$', re.IGNORECASE)


def default_login_domain_for_slug(slug: str) -> str:
    return f'{(slug or "tenant").strip().lower()}.local'


def normalize_login_domain(domain: str) -> str:
    from apps.customers.services.tenants import TenantProvisionError

    value = (domain or '').strip().lower().lstrip('@')
    if not value or not LOGIN_DOMAIN_RE.match(value):
        raise TenantProvisionError(
            'Invalid login domain. Use letters, numbers, dots, and hyphens.',
            status_code=400,
        )
    return value


def build_login_identifier(*, local_username: str, login_domain: str) -> str:
    local = (local_username or '').strip()
    if not local:
        raise ValueError('Username cannot be empty.')
    domain = normalize_login_domain(login_domain)
    return f'{local}@{domain}'.lower()


def login_address_for_user(*, user: User, tenant=None) -> str | None:
    """Build the canonical sign-in id for a tenant user."""
    from django.db import connection

    resolved_tenant = tenant if tenant is not None else getattr(connection, 'tenant', None)
    if resolved_tenant is None or not getattr(resolved_tenant, 'login_domain', None):
        return None
    try:
        return build_login_identifier(
            local_username=user.username,
            login_domain=resolved_tenant.login_domain,
        )
    except Exception:
        return None


def resolve_login_account(login_identifier: str) -> TenantLoginAccount | None:
    """Find a tenant login account by exact sign-in address (username@domain)."""
    key = (login_identifier or '').strip().lower()
    if not key:
        return None

    with schema_context(get_public_schema_name()):
        return (
            TenantLoginAccount.objects.select_related('client')
            .filter(username__iexact=key, client__is_active=True)
            .first()
        )


def register_login_account(*, client: Client, user: User) -> TenantLoginAccount:
    """Register or refresh a tenant user's public login index entry."""
    from apps.customers.services.tenants import TenantProvisionError

    login_id = build_login_identifier(
        local_username=user.username,
        login_domain=client.login_domain,
    )

    with schema_context(get_public_schema_name()):
        existing = TenantLoginAccount.objects.filter(username__iexact=login_id).first()
        if existing is not None and (
            existing.client_id != client.pk or existing.tenant_user_id != user.pk
        ):
            raise TenantProvisionError(
                'Login address already taken on the platform.',
                status_code=400,
            )

        account, _ = TenantLoginAccount.objects.update_or_create(
            client=client,
            tenant_user_id=user.pk,
            defaults={'username': login_id},
        )
        return account


def unregister_login_account(*, client: Client, tenant_user_id: int) -> None:
    with schema_context(get_public_schema_name()):
        TenantLoginAccount.objects.filter(client=client, tenant_user_id=tenant_user_id).delete()


def assert_login_domain_available(*, login_domain: str, exclude_client_id: int | None = None) -> None:
    """Ensure no other tenant already owns this login postfix."""
    from apps.customers.services.tenants import TenantProvisionError

    normalized = normalize_login_domain(login_domain)
    with schema_context(get_public_schema_name()):
        qs = Client.objects.filter(login_domain__iexact=normalized)
        if exclude_client_id is not None:
            qs = qs.exclude(pk=exclude_client_id)
        if qs.exists():
            raise TenantProvisionError(
                'Login domain already used by another organization.',
                status_code=400,
            )


def sync_login_account_username(*, client: Client, user: User, previous_username: str) -> None:
    """Refresh public login id after tenant username change (keyed by tenant_user_id)."""
    del previous_username  # kept for call-site clarity; identity is tenant_user_id
    register_login_account(client=client, user=user)


def resync_client_login_accounts(client: Client) -> int:
    """Rebuild all public login ids for a tenant (e.g. after login_domain change)."""
    with schema_context(client.schema_name):
        users = list(User.objects.all())

    with schema_context(get_public_schema_name()):
        TenantLoginAccount.objects.filter(client=client).delete()

    for user in users:
        register_login_account(client=client, user=user)

    return len(users)


def update_client_login_domain(*, client: Client, login_domain: str) -> Client:
    normalized = normalize_login_domain(login_domain)
    assert_login_domain_available(login_domain=normalized, exclude_client_id=client.pk)

    with schema_context(get_public_schema_name()):
        current = Client.objects.select_for_update().get(pk=client.pk)
        current.login_domain = normalized
        current.save(update_fields=['login_domain', 'updated_at'])
        client = current

    resync_client_login_accounts(client)
    return client
