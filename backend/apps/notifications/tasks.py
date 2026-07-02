import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .email_utils import build_assignment_email_context

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    acks_late=True,
    autoretry_for=(Exception,),
)
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

    context = build_assignment_email_context(
        assignee=assignee,
        ticket=ticket,
        assigned_by=assigned_by,
    )
    html_body = render_to_string('emails/ticket_assigned.html', context)
    text_body = render_to_string('emails/ticket_assigned.txt', context)
    subject = f'{context["assigner_name"]} assigned you to {ticket.ticket_id}'

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
