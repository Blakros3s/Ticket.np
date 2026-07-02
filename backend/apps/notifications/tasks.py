import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _build_assignment_context(assignee, ticket, assigned_by):
    ticket_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/protected/dashboard/tickets/{ticket.id}"
    )
    assigner_name = assigned_by.get_full_name().strip() or assigned_by.username
    return {
        'assignee_name': assignee.get_full_name().strip() or assignee.username,
        'assigner_name': assigner_name,
        'ticket_id': ticket.ticket_id,
        'ticket_title': ticket.title,
        'project_name': ticket.project.name,
        'priority': ticket.get_priority_display(),
        'ticket_url': ticket_url,
    }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_ticket_assignment_email(self, assignee_id, ticket_id, assigned_by_id):
    from apps.tickets.models import Ticket
    from apps.users.models import User

    try:
        assignee = User.objects.get(pk=assignee_id, is_active=True)
        ticket = Ticket.objects.select_related('project').get(pk=ticket_id)
        assigned_by = User.objects.get(pk=assigned_by_id)
    except (User.DoesNotExist, Ticket.DoesNotExist) as exc:
        logger.warning(
            'Assignment email skipped: missing record (assignee=%s, ticket=%s): %s',
            assignee_id,
            ticket_id,
            exc,
        )
        return

    if not assignee.email:
        logger.warning(
            'Assignment email skipped: assignee %s has no email',
            assignee.username,
        )
        return

    context = _build_assignment_context(assignee, ticket, assigned_by)
    subject = f"You were assigned to {ticket.ticket_id}: {ticket.title}"
    text_body = render_to_string(
        'notifications/emails/ticket_assigned.txt',
        context,
    )
    html_body = render_to_string(
        'notifications/emails/ticket_assigned.html',
        context,
    )

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[assignee.email],
        )
        message.attach_alternative(html_body, 'text/html')
        message.send(fail_silently=False)
    except Exception as exc:
        logger.exception(
            'Failed to send assignment email to %s for ticket %s',
            assignee.email,
            ticket.ticket_id,
        )
        raise self.retry(exc=exc)
