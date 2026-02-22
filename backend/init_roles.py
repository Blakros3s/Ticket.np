#!/usr/bin/env python
"""
Script to initialize default department roles.
Run this inside the backend container if roles are missing.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import UserRole

print("Initializing default department roles...")

default_roles = [
    ('frontend', 'Frontend Developer', '#3b82f6'),
    ('backend', 'Backend Developer', '#10b981'),
    ('devops', 'DevOps Engineer', '#f59e0b'),
    ('qa', 'QA Engineer', '#8b5cf6'),
    ('ui_ux', 'UI/UX Designer', '#ec4899'),
    ('product', 'Product Manager', '#ef4444'),
    ('project', 'Project Manager', '#06b6d4'),
    ('data', 'Data Engineer', '#84cc16'),
    ('mobile', 'Mobile Developer', '#f97316'),
    ('fullstack', 'Full Stack Developer', '#6366f1'),
    ('security', 'Security Engineer', '#dc2626'),
    ('database', 'Database Administrator', '#0891b2'),
]

created_count = 0
for name, display_name, color in default_roles:
    role, created = UserRole.objects.get_or_create(
        name=name,
        defaults={'display_name': display_name, 'color': color}
    )
    if created:
        print(f"  Created: {display_name}")
        created_count += 1
    else:
        print(f"  Already exists: {display_name}")

print(f"\nTotal roles created: {created_count}")
print(f"Total roles in database: {UserRole.objects.count()}")
