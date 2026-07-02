from datetime import datetime
from urllib.parse import urlparse

from django.conf import settings


def is_public_frontend_url(url: str | None = None) -> bool:
    """True when FRONTEND_URL is a real public URL (not localhost/dev)."""
    raw = (url if url is not None else settings.FRONTEND_URL).strip()
    parsed = urlparse(raw)
    if parsed.scheme not in ('http', 'https'):
        return False
    host = (parsed.hostname or '').lower()
    if host in ('localhost', '127.0.0.1', '0.0.0.0'):
        return False
    return bool(host)


def get_website_url() -> str:
    """Public site URL for email branding (Technest-style fallback)."""
    return getattr(settings, 'WEBSITE_URL', 'https://technestinnovations.com.np').rstrip('/')


def build_ticket_url(ticket_id: int, frontend_url: str | None = None) -> str | None:
    if not is_public_frontend_url(frontend_url):
        return None
    base = (frontend_url if frontend_url is not None else settings.FRONTEND_URL).rstrip('/')
    return f'{base}/protected/dashboard/tickets/{ticket_id}'


def _friendly_name(user) -> str:
    first = (user.first_name or '').strip()
    if first:
        return first
    full = user.get_full_name().strip()
    if full:
        return full.split()[0]
    return user.username


def build_assignment_email_context(*, assignee, ticket, assigned_by) -> dict:
    assignee_greeting = _friendly_name(assignee)
    assigner_name = assigned_by.get_full_name().strip() or assigned_by.username
    ticket_url = build_ticket_url(ticket.id)

    return {
        'assignee_greeting': assignee_greeting,
        'assigner_name': assigner_name,
        'ticket_id': ticket.ticket_id,
        'ticket_title': ticket.title,
        'project_name': ticket.project.name,
        'priority': ticket.get_priority_display(),
        'ticket_url': ticket_url,
        'website_url': get_website_url(),
        'current_year': datetime.now().year,
    }
