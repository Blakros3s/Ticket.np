from datetime import datetime
from email.utils import formataddr, parseaddr
from urllib.parse import urlparse

from django.conf import settings
from django.db import connection

EMAIL_SUBJECT_PREFIX = '[TicketHub]'


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
    """Public marketing site URL (footer link)."""
    return getattr(settings, 'WEBSITE_URL', 'https://technestinnovations.com.np').rstrip('/')


def get_app_login_url() -> str:
    """App sign-in URL for email CTAs (production login when FRONTEND_URL is localhost)."""
    if is_public_frontend_url():
        return settings.FRONTEND_URL.rstrip('/')
    configured = getattr(settings, 'APP_LOGIN_URL', '').strip()
    if configured:
        return configured.rstrip('/')
    return 'https://login.technestinnovationsofficial.com'


def get_frontend_base_url(request=None) -> str:
    """Frontend origin for in-app links: browser Origin/Referer, else FRONTEND_URL."""
    if request is not None:
        origin = (request.headers.get('Origin') or '').strip()
        parsed = urlparse(origin)
        if parsed.scheme in ('http', 'https') and parsed.netloc:
            return origin.rstrip('/')

        referer = (request.headers.get('Referer') or '').strip()
        parsed = urlparse(referer)
        if parsed.scheme in ('http', 'https') and parsed.netloc:
            return f'{parsed.scheme}://{parsed.netloc}'

    return settings.FRONTEND_URL.rstrip('/')


def build_ticket_url(ticket_id: int, frontend_url: str | None = None) -> str:
    if frontend_url and is_public_frontend_url(frontend_url):
        base = frontend_url.rstrip('/')
    else:
        base = get_app_login_url()
    return f'{base}/protected/dashboard/tickets/{ticket_id}'


def _friendly_name(user) -> str:
    first = (user.first_name or '').strip()
    if first:
        return first
    full = user.get_full_name().strip()
    if full:
        return full.split()[0]
    return user.username


def _organization_name(explicit: str | None = None) -> str:
    if explicit and explicit.strip():
        return explicit.strip()
    tenant = getattr(connection, 'tenant', None)
    if tenant is not None and getattr(tenant, 'name', None):
        return str(tenant.name).strip()
    return ''


def build_assignment_email_context(
    *,
    assignee,
    ticket,
    assigned_by,
    organization_name: str | None = None,
) -> dict:
    assignee_greeting = _friendly_name(assignee)
    assigner_name = assigned_by.get_full_name().strip() or assigned_by.username
    ticket_url = build_ticket_url(ticket.id)
    org_name = _organization_name(organization_name)

    return {
        'assignee_greeting': assignee_greeting,
        'assigner_name': assigner_name,
        'organization_name': org_name,
        'ticket_id': ticket.ticket_id,
        'ticket_title': ticket.title,
        'project_name': ticket.project.name,
        'priority': ticket.get_priority_display(),
        'ticket_url': ticket_url,
        'login_url': get_app_login_url(),
        'website_url': get_website_url(),
        'current_year': datetime.now().year,
    }


def build_assignment_email_subject(context: dict) -> str:
    """Subject line for assignment mail — includes organization when available."""
    org = (context.get('organization_name') or '').strip()
    body = f'{context["assigner_name"]} assigned you to {context["ticket_id"]}'
    if org:
        body = f'{body} ({org})'
    return body


def get_reply_to_email() -> str:
    """Reply-To address for transactional mail (falls back to From SMTP address)."""
    explicit = getattr(settings, 'EMAIL_REPLY_TO', '').strip()
    if explicit:
        return explicit
    _, from_addr = parseaddr(settings.DEFAULT_FROM_EMAIL)
    if from_addr:
        return from_addr
    return settings.EMAIL_HOST_USER


def resolve_from_email() -> str:
    """
    From header aligned with SMTP authenticated user (required for Gmail deliverability).
    If DEFAULT_FROM_EMAIL uses a different address than EMAIL_HOST_USER, use the SMTP user.
    """
    configured = settings.DEFAULT_FROM_EMAIL.strip()
    smtp_user = settings.EMAIL_HOST_USER.strip().lower()
    _, from_addr = parseaddr(configured)
    if smtp_user and from_addr and from_addr.lower() != smtp_user:
        display_name = parseaddr(configured)[0] or 'TicketHub'
        return formataddr((display_name, settings.EMAIL_HOST_USER))
    return configured or formataddr(('TicketHub', settings.EMAIL_HOST_USER))


def build_transactional_headers() -> dict[str, str]:
    """Headers that identify automated transactional mail (reduces spam scoring)."""
    headers = {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Reply-To': get_reply_to_email(),
        'Precedence': 'auto',
    }
    list_id = getattr(settings, 'EMAIL_LIST_ID', '').strip()
    if list_id:
        headers['List-Id'] = list_id
    return headers


def format_notification_subject(body: str) -> str:
    """Consistent branded subject line for inbox filtering."""
    text = body.strip()
    if text.startswith(EMAIL_SUBJECT_PREFIX):
        return text
    return f'{EMAIL_SUBJECT_PREFIX} {text}'


def send_multipart_email(
    *,
    subject: str,
    to: list[str],
    text_body: str,
    html_body: str,
) -> None:
    from django.core.mail import EmailMultiAlternatives

    message = EmailMultiAlternatives(
        subject=format_notification_subject(subject),
        body=text_body,
        from_email=resolve_from_email(),
        to=to,
        headers=build_transactional_headers(),
    )
    message.attach_alternative(html_body, 'text/html')
    message.send(fail_silently=False)
