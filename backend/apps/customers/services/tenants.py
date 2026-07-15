from __future__ import annotations

import re

from django.db import transaction
from django_tenants.utils import schema_context

from apps.customers.models import Client, Domain
from apps.customers.services.plans import assign_plan_to_client, get_client_plan_usage, resolve_unique_schema_name, resolve_unique_slug
from apps.customers.tenant_resolution import internal_domain_for
from apps.customers.services.login_accounts import (
    assert_login_domain_available,
    default_login_domain_for_slug,
    register_login_account,
)
from apps.users.models import User


class TenantProvisionError(Exception):
    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _default_domain_for_schema(schema_name: str) -> str:
    return internal_domain_for(schema_name)


@transaction.atomic
def create_client_with_admin(
    *,
    name: str,
    slug: str,
    schema_name: str | None = None,
    domain: str | None,
    login_domain: str | None = None,
    admin_username: str,
    admin_password: str,
    admin_email: str = '',
    admin_first_name: str = '',
    admin_last_name: str = '',
    plan=None,
) -> tuple[Client, User]:
    resolved_slug = resolve_unique_slug(name=name, slug=slug)
    resolved_schema = schema_name or resolve_unique_schema_name(slug=resolved_slug)

    if not re.match(r'^[a-z][a-z0-9_]*$', resolved_schema):
        raise TenantProvisionError('Invalid schema name. Use lowercase letters, digits, underscores.')

    if Client.objects.filter(schema_name=resolved_schema).exists():
        raise TenantProvisionError('Schema name already exists.')

    resolved_login_domain = login_domain or default_login_domain_for_slug(resolved_slug)
    assert_login_domain_available(login_domain=resolved_login_domain)

    client = Client(
        schema_name=resolved_schema,
        name=name.strip(),
        slug=resolved_slug,
        login_domain=resolved_login_domain,
        is_active=True,
    )
    client.save()

    resolved_domain = (domain or _default_domain_for_schema(resolved_schema)).strip().lower()
    Domain.objects.create(domain=resolved_domain, tenant=client, is_primary=True)

    try:
        with schema_context(client.schema_name):
            if User.objects.filter(username=admin_username).exists():
                raise TenantProvisionError('Username already exists in tenant.')

            admin = User.objects.create_user(
                username=admin_username,
                password=admin_password,
                email=admin_email,
                first_name=admin_first_name.strip() or 'Admin',
                last_name=admin_last_name.strip(),
                role='admin',
            )
            register_login_account(client=client, user=admin)
    except TenantProvisionError:
        client.delete()
        raise
    except Exception:
        client.delete()
        raise

    if plan is not None:
        assign_plan_to_client(client=client, plan=plan)

    return client, admin


def deactivate_client(*, client: Client) -> Client:
    client.is_active = False
    client.save(update_fields=['is_active', 'updated_at'])

    with schema_context(client.schema_name):
        User.objects.filter(is_active=True).update(is_active=False)

    return client


def reactivate_client(*, client: Client) -> Client:
    client.is_active = True
    client.save(update_fields=['is_active', 'updated_at'])

    with schema_context(client.schema_name):
        User.objects.update(is_active=True)

    return client


@transaction.atomic
def delete_client_permanently(*, client: Client) -> str:
    schema_name = client.schema_name
    slug = client.slug
    client.delete(force_drop=True)
    return slug or schema_name


def list_client_users(*, client: Client) -> list[User]:
    with schema_context(client.schema_name):
        return list(User.objects.order_by('username'))


def create_client_user(
    *,
    client: Client,
    username: str,
    password: str,
    role: str = 'employee',
    email: str = '',
    first_name: str = '',
    last_name: str = '',
) -> User:
    plan = None
    try:
        from apps.customers.services.plans import get_client_plan

        plan = get_client_plan(client)
    except Exception:
        pass

    with schema_context(client.schema_name):
        if User.objects.filter(username=username).exists():
            raise TenantProvisionError('Username already exists.')

        if plan is not None:
            usage = get_client_plan_usage(client)
            if usage['users'] >= plan.max_users:
                raise TenantProvisionError(
                    f'Plan limit reached: maximum {plan.max_users} users.',
                    status_code=403,
                )

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
        )
        register_login_account(client=client, user=user)
    return user


def reset_client_user_password(*, client: Client, user_id: int, password: str) -> User:
    with schema_context(client.schema_name):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise TenantProvisionError('User not found.', status_code=404) from exc

        if user.role == 'admin' and User.objects.filter(role='admin', is_active=True).count() == 1:
            pass

        user.set_password(password)
        user.save(update_fields=['password'])
        return user
