import logging

from celery import shared_task
from django.db import connection
from django.template.loader import render_to_string
from django_tenants.utils import schema_context

from apps.customers.tenant_resolution import resolve_tenant

from .email_utils import (
    build_assignment_email_context,
    build_assignment_email_subject,
    send_multipart_email,
)

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    acks_late=True,
    autoretry_for=(Exception,),
)
def send_ticket_assignment_email(
    self,
    tenant_schema: str,
    assignee_id: int,
    ticket_id: int,
    assigned_by_id: int,
):
    from apps.tickets.models import Ticket
    from apps.users.models import User

    tenant = resolve_tenant(tenant_schema)
    if tenant is None:
        logger.warning('Assignment email skipped: unknown tenant %s', tenant_schema)
        return

    with schema_context(tenant.schema_name):
        connection.set_tenant(tenant)
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
            organization_name=tenant.name,
        )
        html_body = render_to_string('emails/ticket_assigned.html', context)
        text_body = render_to_string('emails/ticket_assigned.txt', context)
        subject = build_assignment_email_subject(context)

        try:
            send_multipart_email(
                subject=subject,
                to=[assignee.email],
                text_body=text_body,
                html_body=html_body,
            )
        except Exception as exc:
            logger.exception(
                'Failed to send assignment email to %s for ticket %s',
                assignee.email,
                ticket.ticket_id,
            )
            raise self.retry(exc=exc)
