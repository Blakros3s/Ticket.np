from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied

from apps.customers.models import Client, Plan, PlanTier, SubscriptionStatus, TenantSubscription


class SubscriptionExpiredError(PermissionDenied):
    default_detail = 'Your subscription has expired. Please contact support to renew.'
    default_code = 'subscription_expired'


DEFAULT_PLANS: tuple[dict, ...] = (
    {
        'name': 'Standard',
        'tier': PlanTier.STANDARD,
        'monthly_price': Decimal('2999.00'),
        'max_users': 25,
        'max_projects': 10,
        'attendance_enabled': True,
        'calendar_enabled': True,
        'email_notifications_enabled': True,
        'github_integration_enabled': False,
    },
    {
        'name': 'Premium',
        'tier': PlanTier.PREMIUM,
        'monthly_price': Decimal('5999.00'),
        'max_users': 100,
        'max_projects': 50,
        'attendance_enabled': True,
        'calendar_enabled': True,
        'email_notifications_enabled': True,
        'github_integration_enabled': True,
    },
)


def ensure_default_plans() -> tuple[Plan, Plan]:
    created: list[Plan] = []
    for spec in DEFAULT_PLANS:
        plan, _ = Plan.objects.update_or_create(name=spec['name'], defaults=spec)
        created.append(plan)
    return created[0], created[1]


def get_client_plan(client: Client) -> Plan:
    from django_tenants.utils import get_public_schema_name, schema_context

    with schema_context(get_public_schema_name()):
        try:
            sub = TenantSubscription.objects.select_related('plan').get(client=client)
        except TenantSubscription.DoesNotExist:
            raise SubscriptionExpiredError('No subscription found. Please contact support.')

        if sub.is_effectively_expired:
            raise SubscriptionExpiredError()

        return sub.plan


def sync_subscription_status(client: Client) -> None:
    from django_tenants.utils import get_public_schema_name, schema_context

    with schema_context(get_public_schema_name()):
        try:
            sub = TenantSubscription.objects.get(client=client)
        except TenantSubscription.DoesNotExist:
            return

        if (
            sub.status == SubscriptionStatus.ACTIVE
            and sub.expires_at is not None
            and sub.expires_at < timezone.now()
        ):
            sub.status = SubscriptionStatus.EXPIRED
            sub.save(update_fields=['status', 'updated_at'])


def requires_feature(client: Client, feature: str) -> None:
    plan = get_client_plan(client)
    if not getattr(plan, feature, False):
        raise PermissionDenied('Your plan does not include this feature.')


def get_subscription_display(client: Client) -> TenantSubscription | None:
    from django_tenants.utils import get_public_schema_name, schema_context

    with schema_context(get_public_schema_name()):
        return (
            TenantSubscription.objects.select_related('plan').filter(client=client).first()
        )


def assign_plan_to_client(
    *,
    client: Client,
    plan: Plan,
    expires_at: datetime | None = None,
    notes: str = '',
) -> TenantSubscription:
    sub, _ = TenantSubscription.objects.update_or_create(
        client=client,
        defaults={
            'plan': plan,
            'status': SubscriptionStatus.ACTIVE,
            'expires_at': expires_at,
            'notes': notes,
        },
    )
    return sub


def get_client_plan_usage(client: Client) -> dict[str, int]:
    from django_tenants.utils import schema_context

    with schema_context(client.schema_name):
        from apps.projects.models import Project
        from apps.users.models import User

        return {
            'users': User.objects.count(),
            'projects': Project.objects.count(),
        }


def resolve_unique_slug(*, name: str, slug: str | None = None) -> str:
    base = slugify(slug or name)[:50] or 'tenant'
    candidate = base
    suffix = 1
    while Client.objects.filter(slug=candidate).exists():
        candidate = f'{base}-{suffix}'
        suffix += 1
    return candidate


def resolve_unique_schema_name(*, slug: str) -> str:
    candidate = slugify(slug)[:63].replace('-', '_') or 'tenant'
    suffix = 1
    while Client.objects.filter(schema_name=candidate).exists():
        candidate = f'{slugify(slug)[:50].replace("-", "_")}_{suffix}'
        suffix += 1
    return candidate
