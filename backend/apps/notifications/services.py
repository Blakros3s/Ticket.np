import logging

from django.conf import settings
from django.db import connection, transaction

from .models import Notification
from .tasks import send_ticket_assignment_email

logger = logging.getLogger(__name__)


def _current_tenant_schema() -> str | None:
    from django_tenants.utils import get_public_schema_name

    schema = getattr(connection, 'schema_name', None)
    if not schema or schema == get_public_schema_name():
        return None
    return schema


def _assigner_display_name(user) -> str:
    full = user.get_full_name()
    return full.strip() if full else user.username


def _assignment_message(ticket, assigned_by) -> str:
    return (
        f"You were assigned to ticket {ticket.ticket_id} "
        f"by {_assigner_display_name(assigned_by)}"
    )


def notify_ticket_assigned(*, assignee, ticket, assigned_by) -> None:
    """
    Create an in-app notification and queue an assignment email for the assignee.
    Skips self-assignments and inactive users. Never raises to callers.
    """
    if assignee.id == assigned_by.id:
        return

    if not assignee.is_active:
        return

    message = _assignment_message(ticket, assigned_by)

    try:
        Notification.objects.create(
            user=assignee,
            message=message,
            ticket_id=ticket.id,
            ticket_title=ticket.title[:255],
        )
    except Exception:
        logger.exception(
            'Failed to create in-app notification for ticket assignment '
            '(assignee=%s, ticket=%s)',
            assignee.id,
            ticket.id,
        )

    if not settings.EMAIL_ENABLED:
        return

    if not assignee.email:
        logger.warning(
            'Skipping assignment email: assignee %s has no email address',
            assignee.username,
        )
        return

    try:
        tenant_schema = _current_tenant_schema()
        if tenant_schema is None:
            logger.warning(
                'Skipping assignment email queue: no tenant context '
                '(assignee=%s, ticket=%s)',
                assignee.id,
                ticket.id,
            )
            return

        assignee_id = assignee.id
        ticket_id = ticket.id
        assigned_by_id = assigned_by.id

        def queue_assignment_email() -> None:
            send_ticket_assignment_email.delay(
                tenant_schema,
                assignee_id,
                ticket_id,
                assigned_by_id,
            )

        # ATOMIC_REQUESTS wraps each view in a transaction — queue after commit
        # so Celery can read the ticket row (otherwise "Ticket does not exist").
        transaction.on_commit(queue_assignment_email)
    except Exception:
        logger.exception(
            'Failed to queue assignment email (assignee=%s, ticket=%s)',
            assignee.id,
            ticket.id,
        )
