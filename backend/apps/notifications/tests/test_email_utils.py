from django.test import SimpleTestCase, override_settings

from apps.notifications.email_utils import _friendly_name, build_assignment_email_context


class EmailUtilsTestCase(SimpleTestCase):
    def test_localhost_is_not_public(self):
        from apps.notifications.email_utils import is_public_frontend_url

        self.assertFalse(is_public_frontend_url('http://localhost:3000'))
        self.assertFalse(is_public_frontend_url('http://127.0.0.1:3000'))

    def test_https_domain_is_public(self):
        from apps.notifications.email_utils import is_public_frontend_url

        self.assertTrue(is_public_frontend_url('https://app.tickethub.com'))

    def test_friendly_name_uses_first_name(self):
        class User:
            first_name = 'Tilak'
            username = 'tilak'

            def get_full_name(self):
                return 'Tilak Paneru'

        self.assertEqual(_friendly_name(User()), 'Tilak')

    def test_get_website_url_default(self):
        from apps.notifications.email_utils import get_website_url

        with override_settings(WEBSITE_URL='https://technestinnovations.com.np'):
            self.assertEqual(get_website_url(), 'https://technestinnovations.com.np')

    def test_build_ticket_url_skips_localhost(self):
        from apps.notifications.email_utils import build_ticket_url

        with override_settings(FRONTEND_URL='http://localhost:3000'):
            self.assertIsNone(build_ticket_url(42))

    def test_build_ticket_url_for_public_domain(self):
        from apps.notifications.email_utils import build_ticket_url

        with override_settings(FRONTEND_URL='https://app.tickethub.com'):
            self.assertEqual(
                build_ticket_url(42),
                'https://app.tickethub.com/protected/dashboard/tickets/42',
            )

    @override_settings(FRONTEND_URL='http://localhost:3000', WEBSITE_URL='https://technestinnovations.com.np')
    def test_assignment_context_includes_website_url(self):
        class Project:
            name = 'Demo Project'

        class Ticket:
            id = 7
            ticket_id = 'TKT-001'
            title = 'Sample'
            project = Project()

            def get_priority_display(self):
                return 'High'

        class User:
            first_name = 'Assignee'
            username = 'assignee'

            def get_full_name(self):
                return 'Assignee User'

        context = build_assignment_email_context(
            assignee=User(),
            ticket=Ticket(),
            assigned_by=User(),
        )
        self.assertEqual(context['assignee_greeting'], 'Assignee')
        self.assertEqual(context['website_url'], 'https://technestinnovations.com.np')
        self.assertIsNone(context['ticket_url'])
