from __future__ import annotations

import hashlib
import hmac
import logging
import secrets

from django.conf import settings
from django.db import connection
from django.utils import timezone

from apps.activity.utils import log_activity
from apps.integrations.models import GitHubConnection, TicketGitHubLink
from apps.integrations.services.crypto import decrypt_text
from apps.integrations.services.github_client import GitHubAPIError, GitHubClient
from apps.integrations.services.repo_utils import github_issue_labels, parse_github_repo_url
from apps.tickets.models import Ticket

logger = logging.getLogger(__name__)


def get_active_connection() -> GitHubConnection | None:
    return GitHubConnection.objects.order_by('-connected_at').first()


def get_github_client() -> GitHubClient | None:
    connection_row = get_active_connection()
    if not connection_row:
        return None
    token = decrypt_text(connection_row.access_token_encrypted)
    return GitHubClient(token)


def webhook_callback_url(tenant_slug: str) -> str:
    base = settings.BACKEND_PUBLIC_URL.rstrip('/')
    return f'{base}/api/public/integrations/github/webhook/{tenant_slug}/'


def verify_webhook_signature(payload: bytes, signature_header: str | None, secret: str) -> bool:
    if not signature_header or not secret:
        return False
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def ensure_repo_webhook(owner: str, repo: str, tenant_slug: str) -> None:
    connection_row = get_active_connection()
    client = get_github_client()
    if not connection_row or not client:
        return

    if not connection_row.webhook_secret:
        connection_row.webhook_secret = secrets.token_hex(32)
        connection_row.save(update_fields=['webhook_secret'])

    callback_url = webhook_callback_url(tenant_slug)
    secret = connection_row.webhook_secret

    try:
        hooks = client.list_repo_hooks(owner, repo)
        for hook in hooks:
            config = hook.get('config') or {}
            if config.get('url') == callback_url:
                return
        client.create_repo_hook(owner, repo, callback_url=callback_url, secret=secret)
    except GitHubAPIError as exc:
        logger.warning('Unable to register GitHub webhook for %s/%s: %s', owner, repo, exc)


def build_issue_title(ticket: Ticket) -> str:
    return f'[{ticket.ticket_id}] {ticket.title}'


def build_issue_body(ticket: Ticket, *, frontend_base_url: str | None = None) -> str:
    base = (frontend_base_url or settings.FRONTEND_URL).rstrip('/')
    ticket_url = f'{base}/protected/dashboard/tickets/{ticket.id}'
    return (
        f'{ticket.description}\n\n'
        f'---\n'
        f'**TicketHub:** [{ticket.ticket_id}]({ticket_url})\n'
        f'**Type:** {ticket.get_type_display()}\n'
        f'**Priority:** {ticket.get_priority_display()}\n'
    )


def create_github_issue_for_ticket(
    ticket: Ticket,
    *,
    user,
    tenant_slug: str,
    frontend_base_url: str | None = None,
) -> TicketGitHubLink:
    try:
        ticket.github_link
    except TicketGitHubLink.DoesNotExist:
        pass
    else:
        raise ValueError('This ticket is already linked to a GitHub issue')

    repo = parse_github_repo_url(ticket.project.github_repo)
    if not repo:
        raise ValueError('Project does not have a valid GitHub repository URL')

    owner, repo_name = repo
    client = get_github_client()
    if not client:
        raise ValueError('GitHub is not connected for this organization')

    ensure_repo_webhook(owner, repo_name, tenant_slug)

    title = build_issue_title(ticket)
    issue = client.create_issue(
        owner,
        repo_name,
        title=title,
        body=build_issue_body(ticket, frontend_base_url=frontend_base_url),
        labels=github_issue_labels(ticket.type),
    )

    link = TicketGitHubLink.objects.create(
        ticket=ticket,
        repo_owner=owner,
        repo_name=repo_name,
        issue_number=issue['number'],
        github_issue_id=issue['id'],
        issue_url=issue['html_url'],
    )
    link.mark_synced()

    log_activity(
        action='update',
        user=user,
        instance=ticket,
        description=f'Linked ticket to GitHub issue #{issue["number"]}',
        extra_data={'issue_url': issue['html_url'], 'source': 'github'},
    )
    return link


def ticket_status_to_github_state(status: str) -> str | None:
    if status == 'closed':
        return 'closed'
    if status in {'new', 'in_progress', 'qa', 'reopened'}:
        return 'open'
    return None


def sync_ticket_status_to_github(ticket: Ticket, new_status: str) -> None:
    if getattr(ticket, '_github_sync_source', False):
        return

    link = getattr(ticket, 'github_link', None)
    if link is None:
        try:
            link = ticket.github_link
        except TicketGitHubLink.DoesNotExist:
            return

    if link.sync_status == TicketGitHubLink.SYNC_DISCONNECTED:
        return

    github_state = ticket_status_to_github_state(new_status)
    if github_state is None:
        return

    client = get_github_client()
    if not client:
        link.mark_error('GitHub connection is not configured')
        return

    try:
        client.update_issue_state(link.repo_owner, link.repo_name, link.issue_number, github_state)
        link.mark_synced()
    except GitHubAPIError as exc:
        link.mark_error(str(exc))
        logger.warning('GitHub status sync failed for ticket %s: %s', ticket.ticket_id, exc)


def sync_ticket_content_to_github(ticket: Ticket, *, frontend_base_url: str | None = None) -> None:
    """Push ticket title/description (and metadata footer) to the linked GitHub issue."""
    if getattr(ticket, '_github_sync_source', False):
        return

    try:
        link = ticket.github_link
    except TicketGitHubLink.DoesNotExist:
        return

    if link.sync_status == TicketGitHubLink.SYNC_DISCONNECTED:
        return

    client = get_github_client()
    if not client:
        link.mark_error('GitHub connection is not configured')
        return

    try:
        client.update_issue(
            link.repo_owner,
            link.repo_name,
            link.issue_number,
            title=build_issue_title(ticket),
            body=build_issue_body(ticket, frontend_base_url=frontend_base_url),
        )
        link.mark_synced()
    except GitHubAPIError as exc:
        link.mark_error(str(exc))
        logger.warning('GitHub content sync failed for ticket %s: %s', ticket.ticket_id, exc)


def apply_github_issue_state_to_ticket(
    *,
    owner: str,
    repo: str,
    issue_number: int,
    github_state: str,
    actor_login: str | None = None,
) -> Ticket | None:
    try:
        link = TicketGitHubLink.objects.select_related('ticket').get(
            repo_owner=owner,
            repo_name=repo,
            issue_number=issue_number,
        )
    except TicketGitHubLink.DoesNotExist:
        return None

    ticket = link.ticket
    old_status = ticket.status

    if github_state == 'closed' and ticket.status != 'closed':
        ticket._github_sync_source = True
        ticket.status = 'closed'
        ticket.closed_at = timezone.now()
        ticket.save(update_fields=['status', 'closed_at', 'updated_at'])
        link.mark_synced()
        log_activity(
            action='status_change',
            user=None,
            instance=ticket,
            description=(
                f"Ticket {ticket.ticket_id} closed via GitHub"
                + (f' by @{actor_login}' if actor_login else '')
            ),
            extra_data={'old_status': old_status, 'new_status': 'closed', 'source': 'github'},
        )
        return ticket

    if github_state == 'open' and ticket.status == 'closed':
        ticket._github_sync_source = True
        ticket.status = 'reopened'
        ticket.closed_at = None
        ticket.assignees.clear()
        ticket.save(update_fields=['status', 'closed_at', 'updated_at'])
        link.mark_synced()
        log_activity(
            action='status_change',
            user=None,
            instance=ticket,
            description=(
                f"Ticket {ticket.ticket_id} reopened via GitHub"
                + (f' by @{actor_login}' if actor_login else '')
            ),
            extra_data={'old_status': old_status, 'new_status': 'reopened', 'source': 'github'},
        )
        return ticket

    return None


def pull_github_issue_state_for_ticket(ticket: Ticket) -> bool:
    """Fetch linked GitHub issue state and apply closed/reopened to the ticket."""
    try:
        link = ticket.github_link
    except TicketGitHubLink.DoesNotExist:
        return False

    if link.sync_status == TicketGitHubLink.SYNC_DISCONNECTED:
        return False

    client = get_github_client()
    if not client:
        return False

    try:
        issue = client.get_issue(link.repo_owner, link.repo_name, link.issue_number)
    except GitHubAPIError as exc:
        link.mark_error(str(exc))
        logger.warning('GitHub pull sync failed for ticket %s: %s', ticket.ticket_id, exc)
        return False

    github_state = issue.get('state')
    if not github_state:
        return False

    updated = apply_github_issue_state_to_ticket(
        owner=link.repo_owner,
        repo=link.repo_name,
        issue_number=link.issue_number,
        github_state=github_state,
    )
    if updated is not None:
        link.mark_synced()
        return True
    return False


def current_tenant_slug() -> str:
    tenant = getattr(connection, 'tenant', None)
    if tenant is None:
        return ''
    return getattr(tenant, 'slug', '') or getattr(tenant, 'schema_name', '')
