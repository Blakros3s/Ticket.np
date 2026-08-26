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

    def test_build_ticket_url_uses_app_login_when_frontend_is_localhost(self):
        from apps.notifications.email_utils import build_ticket_url

        with override_settings(
            FRONTEND_URL='http://localhost:3000',
            APP_LOGIN_URL='https://login.technestinnovationsofficial.com',
        ):
            self.assertEqual(
                build_ticket_url(42),
                'https://login.technestinnovationsofficial.com/protected/dashboard/tickets/42',
            )

    def test_get_app_login_url_prefers_public_frontend(self):
        from apps.notifications.email_utils import get_app_login_url

        with override_settings(
            FRONTEND_URL='https://app.tickethub.com',
            APP_LOGIN_URL='https://login.technestinnovationsofficial.com',
        ):
            self.assertEqual(get_app_login_url(), 'https://app.tickethub.com')

    def test_build_ticket_url_for_public_domain(self):
        from apps.notifications.email_utils import build_ticket_url

        with override_settings(FRONTEND_URL='https://app.tickethub.com'):
            self.assertEqual(
                build_ticket_url(42),
                'https://app.tickethub.com/protected/dashboard/tickets/42',
            )

    @override_settings(
        FRONTEND_URL='http://localhost:3000',
        WEBSITE_URL='https://technestinnovations.com.np',
        APP_LOGIN_URL='https://login.technestinnovationsofficial.com',
    )
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
            organization_name='Technest Hub',
        )
        self.assertEqual(context['assignee_greeting'], 'Assignee')
        self.assertEqual(context['organization_name'], 'Technest Hub')
        self.assertEqual(context['website_url'], 'https://technestinnovations.com.np')
        self.assertEqual(
            context['login_url'],
            'https://login.technestinnovationsofficial.com',
        )
        self.assertEqual(
            context['ticket_url'],
            'https://login.technestinnovationsofficial.com/protected/dashboard/tickets/7',
        )

    def test_assignment_subject_includes_organization(self):
        from apps.notifications.email_utils import build_assignment_email_subject

        subject = build_assignment_email_subject({
            'assigner_name': 'John',
            'ticket_id': 'TKT-001',
            'organization_name': 'Technest Hub',
        })
        self.assertEqual(subject, 'John assigned you to TKT-001 (Technest Hub)')

    def test_format_notification_subject_adds_prefix(self):
        from apps.notifications.email_utils import format_notification_subject

        self.assertEqual(
            format_notification_subject('assigner assigned you to TKT-0001'),
            '[TicketHub] assigner assigned you to TKT-0001',
        )
        self.assertEqual(
            format_notification_subject('[TicketHub] already prefixed'),
            '[TicketHub] already prefixed',
        )

    @override_settings(
        DEFAULT_FROM_EMAIL='TicketHub <noreply@custom.com>',
        EMAIL_HOST_USER='smtp@gmail.com',
    )
    def test_resolve_from_email_aligns_with_smtp_user(self):
        from apps.notifications.email_utils import resolve_from_email

        self.assertIn('smtp@gmail.com', resolve_from_email())

    @override_settings(EMAIL_REPLY_TO='support@technestinnovations.com.np')
    def test_reply_to_from_settings(self):
        from apps.notifications.email_utils import get_reply_to_email

        self.assertEqual(get_reply_to_email(), 'support@technestinnovations.com.np')

    def test_transactional_headers(self):
        from apps.notifications.email_utils import build_transactional_headers

        headers = build_transactional_headers()
        self.assertEqual(headers['Auto-Submitted'], 'auto-generated')
        self.assertEqual(headers['Precedence'], 'auto')
        self.assertIn('Reply-To', headers)
