from decimal import Decimal

from django.db import models
from django.utils import timezone
from django_tenants.models import DomainMixin, TenantMixin


class Client(TenantMixin):
    """Tenant registry — one PostgreSQL schema per client."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=64, unique=True)
    login_domain = models.CharField(
        max_length=120,
        help_text='Login postfix for tenant users, e.g. technest.com → user@technest.com',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    auto_create_schema = True
    auto_drop_schema = True

    class Meta:
        db_table = 'customers_client'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name or self.schema_name


class Domain(DomainMixin):
    class Meta:
        db_table = 'customers_domain'


class TenantLoginAccount(models.Model):
    """Public-schema login index — maps a unique username to a tenant user."""

    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='login_accounts',
    )
    username = models.CharField(max_length=150, unique=True)
    tenant_user_id = models.PositiveIntegerField()

    class Meta:
        db_table = 'customers_tenant_login_account'
        constraints = [
            models.UniqueConstraint(
                fields=['client', 'tenant_user_id'],
                name='customers_login_account_client_user_uniq',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.username} → {self.client.schema_name}'


class PublicDocShareIndex(models.Model):
    """Public-schema lookup for unauthenticated doc share links."""

    token = models.UUIDField(primary_key=True, editable=False)
    tenant_schema = models.CharField(max_length=63, db_index=True)
    doc_id = models.UUIDField()
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_public_doc_share_index'

    def __str__(self) -> str:
        return f'{self.token} → {self.tenant_schema}:{self.doc_id}'


class PublicDocShareAccessLog(models.Model):
    share_index = models.ForeignKey(
        PublicDocShareIndex,
        on_delete=models.CASCADE,
        related_name='access_logs',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_public_doc_share_access_log'
        ordering = ['-accessed_at']


class PublicWhiteboardShareIndex(models.Model):
    """Public-schema lookup for unauthenticated whiteboard share links."""

    token = models.UUIDField(primary_key=True, editable=False)
    tenant_schema = models.CharField(max_length=63, db_index=True)
    whiteboard_id = models.UUIDField()
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_public_whiteboard_share_index'

    def __str__(self) -> str:
        return f'{self.token} → {self.tenant_schema}:{self.whiteboard_id}'


class PublicWhiteboardShareAccessLog(models.Model):
    share_index = models.ForeignKey(
        PublicWhiteboardShareIndex,
        on_delete=models.CASCADE,
        related_name='access_logs',
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_public_whiteboard_share_access_log'
        ordering = ['-accessed_at']


class PlanTier(models.TextChoices):
    STANDARD = 'standard', 'Standard'
    PREMIUM = 'premium', 'Premium'


class Plan(models.Model):
    """Platform-wide subscription tiers managed by server admin."""

    name = models.CharField(max_length=60, unique=True)
    tier = models.CharField(max_length=20, choices=PlanTier.choices, db_index=True)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    max_users = models.PositiveIntegerField(default=25)
    max_projects = models.PositiveIntegerField(default=10)
    attendance_enabled = models.BooleanField(default=True)
    calendar_enabled = models.BooleanField(default=True)
    email_notifications_enabled = models.BooleanField(default=True)
    github_integration_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers_plan'
        ordering = ['monthly_price']

    def __str__(self) -> str:
        return self.name


class SubscriptionStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    EXPIRED = 'expired', 'Expired'
    CANCELLED = 'cancelled', 'Cancelled'


class TenantSubscription(models.Model):
    """One subscription per tenant — assigned and renewed by server admin."""

    client = models.OneToOneField(
        Client,
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
    )
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers_tenant_subscription'

    @property
    def is_effectively_expired(self) -> bool:
        if self.status in {SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED}:
            return True
        return self.expires_at is not None and self.expires_at < timezone.now()
