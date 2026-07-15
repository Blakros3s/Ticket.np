import getpass
import os

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from apps.customers.services.plans import ensure_default_plans
from apps.customers.tenant_resolution import set_public_schema
from apps.platform.models import PlatformUser


class Command(BaseCommand):
    help = (
        'Create a platform server admin (PlatformUser) in the public schema. '
        'Seeds default subscription plans if missing.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--username', dest='username')
        parser.add_argument('--email', dest='email', default='')
        parser.add_argument('--password', dest='password')
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='Non-interactive mode. Use flags or DJANGO_SUPERUSER_* env vars.',
        )

    def handle(self, *args, **options):
        set_public_schema()

        standard, premium = ensure_default_plans()
        self.stdout.write(self.style.SUCCESS(f'Plans ready: {standard.name}, {premium.name}'))

        username = options['username']
        email = options['email'] or ''
        password = options['password']
        noinput = options['noinput']

        if noinput:
            username = username or os.environ.get('DJANGO_SUPERUSER_USERNAME')
            email = email or os.environ.get('DJANGO_SUPERUSER_EMAIL', '')
            password = password or os.environ.get('DJANGO_SUPERUSER_PASSWORD')
            if not username or not password:
                raise CommandError(
                    'Username and password are required with --noinput. '
                    'Pass --username/--password or set DJANGO_SUPERUSER_USERNAME '
                    'and DJANGO_SUPERUSER_PASSWORD.'
                )
        else:
            username = username or self._prompt('Username')
            if not email:
                email = self._prompt('Email address', required=False)
            password = password or self._prompt_password()

        self._validate_email(email)

        if PlatformUser.objects.filter(username=username).exists():
            raise CommandError(f'Server admin "{username}" already exists.')

        PlatformUser.objects.create_user(
            username=username,
            password=password,
            email=email,
        )

        self.stdout.write(self.style.SUCCESS(f'Created server admin: {username}'))
        self.stdout.write('Authenticate at POST /api/server/auth/login/')

    def _prompt(self, field: str, *, required: bool = True) -> str:
        while True:
            value = input(f'{field}: ').strip()
            if value or not required:
                return value
            self.stderr.write(f'Error: {field} cannot be blank.')

    def _prompt_password(self) -> str:
        while True:
            password = getpass.getpass('Password: ')
            password_confirm = getpass.getpass('Password (again): ')
            if password != password_confirm:
                self.stderr.write('Error: Your passwords did not match.')
                continue
            if not password:
                self.stderr.write('Error: Blank passwords are not allowed.')
                continue
            return password

    @staticmethod
    def _validate_email(email: str) -> None:
        if not email:
            return
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError(str(exc)) from exc
