from django.core.management.base import BaseCommand
from apps.users.models import User


class Command(BaseCommand):
    help = 'Create test users for all roles (admin, manager, employee)'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating test users...')

        # Test users data
        test_users = [
            {
                'username': 'admin',
                'email': 'admin@tickethub.com',
                'password': 'admin123',
                'first_name': 'Admin',
                'last_name': 'User',
                'role': 'admin',
                'is_active': True,
            },
            {
                'username': 'manager',
                'email': 'manager@tickethub.com',
                'password': 'manager123',
                'first_name': 'Manager',
                'last_name': 'User',
                'role': 'manager',
                'is_active': True,
            },
            {
                'username': 'employee',
                'email': 'employee@tickethub.com',
                'password': 'employee123',
                'first_name': 'Employee',
                'last_name': 'User',
                'role': 'employee',
                'is_active': True,
            },
            {
                'username': 'john',
                'email': 'john@tickethub.com',
                'password': 'john123',
                'first_name': 'John',
                'last_name': 'Doe',
                'role': 'employee',
                'is_active': True,
            },
            {
                'username': 'sarah',
                'email': 'sarah@tickethub.com',
                'password': 'sarah123',
                'first_name': 'Sarah',
                'last_name': 'Smith',
                'role': 'manager',
                'is_active': True,
            },
        ]

        created_count = 0
        existing_count = 0

        for user_data in test_users:
            username = user_data['username']
            password = user_data.pop('password')

            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'User "{username}" already exists, skipping...')
                )
                existing_count += 1
                continue

            user = User.objects.create_user(
                password=password,
                **user_data
            )
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Created user: {username} ({user_data["role"]})')
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('Test Users Creation Summary:'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(f'Created: {created_count} users')
        self.stdout.write(f'Already existed: {existing_count} users')
        self.stdout.write('')
        self.stdout.write('Login Credentials:')
        self.stdout.write('  Admin:     admin / admin123')
        self.stdout.write('  Manager:   manager / manager123')
        self.stdout.write('  Manager:   sarah / sarah123')
        self.stdout.write('  Employee:  employee / employee123')
        self.stdout.write('  Employee:  john / john123')
        self.stdout.write('')
