import logging

from celery import shared_task
from django.db import connection
from django_tenants.utils import schema_context

from apps.customers.tenant_resolution import resolve_tenant

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=15,
    acks_late=True,
    autoretry_for=(Exception,),
)
def sync_ticket_status_to_github_task(self, tenant_schema: str, ticket_id: int, new_status: str):
    from apps.integrations.services.github_sync import sync_ticket_status_to_github
    from apps.tickets.models import Ticket

    tenant = resolve_tenant(tenant_schema)
    if tenant is None:
        logger.warning('GitHub sync skipped: unknown tenant %s', tenant_schema)
        return

    with schema_context(tenant.schema_name):
        connection.set_tenant(tenant)
        try:
            ticket = Ticket.objects.select_related('project').get(pk=ticket_id)
        except Ticket.DoesNotExist:
            logger.warning('GitHub sync skipped: ticket %s not found', ticket_id)
            return
        sync_ticket_status_to_github(ticket, new_status)
