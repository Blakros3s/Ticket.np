#!/usr/bin/env python
"""
Script to check if department roles table exists and list any existing roles.
Run this inside the backend container to debug database issues.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import UserRole

print("Checking UserRole table...")
print(f"Table name: {UserRole._meta.db_table}")
print(f"Total roles in database: {UserRole.objects.count()}")

if UserRole.objects.exists():
    print("\nExisting roles:")
    for role in UserRole.objects.all():
        print(f"  - {role.name} ({role.display_name}) - {role.color}")
else:
    print("\nNo roles found in database.")
