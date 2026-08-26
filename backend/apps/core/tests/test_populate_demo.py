from django.core.management import call_command
from django.test import TestCase
from django_tenants.utils import schema_context

from apps.core.populate_demo import DEMO_TENANT_SCHEMA, TICKET_SCENARIO_CATALOG
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.users.models import User


class PopulateDemoCommandTests(TestCase):
    def test_populate_demo_creates_scenario_tickets(self):
        call_command('populate_demo', '--flush', verbosity=0)

        with schema_context(DEMO_TENANT_SCHEMA):
            self.assertGreaterEqual(User.objects.filter(role='admin').count(), 1)
            self.assertGreaterEqual(Project.objects.filter(status='active').count(), 3)

            for spec in TICKET_SCENARIO_CATALOG:
                self.assertTrue(
                    Ticket.objects.filter(title=spec['title'], status=spec['status']).exists(),
                    f'Missing scenario ticket: {spec["key"]}',
                )

            demo_tickets = Ticket.objects.filter(title__startswith='[Demo]')
            self.assertGreaterEqual(demo_tickets.count(), len(TICKET_SCENARIO_CATALOG))

    def test_populate_demo_is_idempotent(self):
        call_command('populate_demo', '--flush', verbosity=0)
        call_command('populate_demo', verbosity=0)

        with schema_context(DEMO_TENANT_SCHEMA):
            self.assertGreaterEqual(Ticket.objects.count(), len(TICKET_SCENARIO_CATALOG))
