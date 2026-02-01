#!/usr/bin/env python
"""Creates a superuser for the TicketHub application."""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def create_super_user():
    username = input("Enter admin username: ")
    email = input("Enter admin email: ")
    password = input("Enter admin password: ")
    first_name = input("Enter admin first name: ")
    last_name = input("Enter admin last name: ")

    if User.objects.filter(username=username).exists():
        print(f"Error: User '{username}' already exists!")
        return

    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role='admin'
    )

    print(f"\n✓ Superuser '{username}' created successfully!")
    print(f"  Email: {email}")
    print(f"  Role: admin")
    print("\nYou can now login at http://localhost:3000/auth/login")
    print("Django admin panel: http://localhost:8000/admin/")

if __name__ == '__main__':
    create_super_user()
