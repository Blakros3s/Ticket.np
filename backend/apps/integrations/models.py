from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.tickets.models import Ticket
from apps.users.models import User


class GitHubConnection(models.Model):
    """Tenant-wide GitHub OAuth connection (one active per tenant)."""

    github_user_id = models.PositiveBigIntegerField()
    github_login = models.CharField(max_length=255)
    access_token_encrypted = models.TextField()
    token_scope = models.CharField(max_length=255, blank=True)
    webhook_secret = models.CharField(max_length=64, blank=True)
    connected_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='github_connections',
    )
    connected_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'integrations_github_connection'
        verbose_name = 'GitHub connection'

    def __str__(self) -> str:
        return f'GitHub @{self.github_login}'


class TicketGitHubLink(models.Model):
    SYNC_LINKED = 'linked'
    SYNC_ERROR = 'error'
    SYNC_DISCONNECTED = 'disconnected'
    SYNC_CHOICES = [
        (SYNC_LINKED, 'Linked'),
        (SYNC_ERROR, 'Error'),
        (SYNC_DISCONNECTED, 'Disconnected'),
    ]

    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name='github_link',
    )
    repo_owner = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255)
    issue_number = models.PositiveIntegerField()
    github_issue_id = models.PositiveBigIntegerField()
    issue_url = models.URLField(max_length=500)
    sync_status = models.CharField(
        max_length=20,
        choices=SYNC_CHOICES,
        default=SYNC_LINKED,
    )
    last_sync_error = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'integrations_ticket_github_link'
        constraints = [
            models.UniqueConstraint(
                fields=['repo_owner', 'repo_name', 'issue_number'],
                name='integrations_unique_github_issue_per_repo',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.repo_owner}/{self.repo_name}#{self.issue_number}'

    def mark_synced(self) -> None:
        self.last_synced_at = timezone.now()
        self.last_sync_error = ''
        self.sync_status = self.SYNC_LINKED
        self.save(update_fields=['last_synced_at', 'last_sync_error', 'sync_status'])

    def mark_error(self, message: str) -> None:
        self.last_sync_error = message[:2000]
        self.sync_status = self.SYNC_ERROR
        self.save(update_fields=['last_sync_error', 'sync_status'])
