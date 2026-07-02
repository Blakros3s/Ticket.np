import logging

from django.conf import settings

from .models import Notification
from .tasks import send_ticket_assignment_email

logger = logging.getLogger(__name__)


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
        send_ticket_assignment_email.delay(
            assignee.id,
            ticket.id,
            assigned_by.id,
        )
    except Exception:
        logger.exception(
            'Failed to queue assignment email (assignee=%s, ticket=%s)',
            assignee.id,
            ticket.id,
        )
