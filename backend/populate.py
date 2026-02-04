#!/usr/bin/env python
"""
Populate TicketHub with realistic dummy data for testing and demo purposes.

Usage:
    python manage.py shell < populate.py
    OR
    docker-compose exec backend python manage.py shell < populate.py
"""

from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, datetime
import random

from apps.users.models import User
from apps.projects.models import Project, ProjectMember
from apps.tickets.models import Ticket
from apps.comments.models import Comment
from apps.timelogs.models import WorkLog
from apps.activity.models import ActivityLog
from django.contrib.contenttypes.models import ContentType

# Clear existing data (optional - uncomment if you want to start fresh)
# User.objects.exclude(username='admin').delete()
# Project.objects.all().delete()
# Ticket.objects.all().delete()
# Comment.objects.all().delete()
# WorkLog.objects.all().delete()
# ActivityLog.objects.all().delete()


# Realistic sample data
FIRST_NAMES = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria', 'Alex', 'Sophie']
LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas']

PROJECT_NAMES = [
    'Website Redesign',
    'Mobile App Development',
    'API Integration',
    'E-commerce Platform',
    'Customer Portal',
    'Analytics Dashboard',
    'Payment Gateway Integration',
    'User Management System',
    'Email Service Enhancement',
    'Security Audit',
]

PROJECT_DESCRIPTIONS = [
    'Complete overhaul of the company website with modern design and improved user experience.',
    'Develop a cross-platform mobile application for iOS and Android devices.',
    'Integrate with third-party APIs to enhance system functionality and data exchange.',
    'Build a full-featured e-commerce platform with cart, checkout, and payment processing.',
    'Customer-facing portal for account management, order tracking, and support.',
    'Real-time analytics dashboard for monitoring key business metrics and KPIs.',
    'Implement secure payment processing with support for multiple payment methods.',
    'Comprehensive user management system with roles, permissions, and authentication.',
    'Upgrade email service with templates, scheduling, and analytics capabilities.',
    'Conduct thorough security audit and implement recommended security improvements.',
]

TICKET_TITLES = [
    'Login page authentication fails',
    'Dashboard loading slow',
    'Add export to CSV functionality',
    'User profile photo upload',
    'Fix responsive layout issues',
    'Implement dark mode',
    'Password reset email not sending',
    'Search functionality not working',
    'Add filtering options',
    'Optimize database queries',
    'API rate limiting issue',
    'Mobile menu not opening',
    'File upload progress bar',
    'Notification system',
    'Backup scheduler',
    'Analytics integration',
    'Multi-language support',
    'Payment error handling',
    'Role-based access control',
    'Session timeout configuration',
]

TICKET_DESCRIPTIONS = [
    'Users are reporting authentication failures when attempting to login with valid credentials.',
    'The dashboard page is taking more than 5 seconds to load, which is affecting user experience.',
    'Users need the ability to export data to CSV format for reporting purposes.',
    'Allow users to upload and update their profile photos with proper validation.',
    'The layout breaks on tablet and mobile devices, especially in landscape mode.',
    'Implement a dark mode theme that users can toggle in their settings.',
    'Password reset emails are not being delivered to users email addresses.',
    'The search functionality is not returning accurate results or is sometimes unresponsive.',
    'Add advanced filtering options to allow users to filter data by multiple criteria.',
    'Database queries are not optimized, causing slow response times for large datasets.',
    'API endpoints are being called too frequently, need to implement proper rate limiting.',
    'The hamburger menu on mobile devices is not responding when clicked.',
    'Add a progress bar to show upload status for large file uploads.',
    'Build a notification system to alert users of important events and updates.',
    'Create an automated backup scheduler for database and file backups.',
    'Integrate with analytics services like Google Analytics for usage tracking.',
    'Support multiple languages to serve international customers effectively.',
    'Improve error handling for payment processing failures and retries.',
    'Implement fine-grained role-based access control for different user types.',
    'Configure session timeout settings for security and compliance.',
]

COMMENT_TEMPLATES = [
    'I have started working on this issue.',
    'Found the root cause. The problem is in the authentication service.',
    'This requires changes to the database schema.',
    'Can you provide more details about the expected behavior?',
    'I have tested the fix and it seems to be working correctly.',
    'This is a higher priority issue that should be addressed soon.',
    'Working on a temporary workaround while we implement the permanent fix.',
    'The changes have been deployed to staging for testing.',
    'I need access to production logs to debug this further.',
    'This is blocking other tasks, please prioritize.',
    'Great work! The fix looks good.',
    'Please update the documentation once this is complete.',
    'I have added unit tests for this functionality.',
    'There might be edge cases we need to consider.',
    'The implementation looks solid, ready for review.',
]

WORK_LOG_NOTES = [
    'Analyzed the issue and identified the root cause.',
    'Implemented the core functionality.',
    'Refactored existing code for better performance.',
    'Fixed identified bugs and edge cases.',
    'Wrote unit tests to ensure code quality.',
    'Updated documentation and API specs.',
    'Code review and feedback incorporation.',
    'Deployment to staging environment.',
    'Integration testing with other services.',
    'Performance optimization and tuning.',
    'Database migration and schema updates.',
    'User acceptance testing and feedback collection.',
]


def create_user(username, email, password, role, first_name, last_name):
    """Create or update a user."""
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'role': role,
            'is_active': True,
        }
    )
    user.set_password(password)
    user.save()
    print(f"{'Created' if created else 'Updated'} user: {username} ({role})")
    return user


def create_users():
    """Create a set of realistic users."""
    print("\n=== Creating Users ===")
    
    users = {}
    
    # Admin user
    admin_user = create_user(
        username='admin',
        email='admin@tickethub.com',
        password='admin123',
        role='admin',
        first_name='System',
        last_name='Administrator'
    )
    users['admin'] = admin_user
    
    # Manager users
    manager_data = [
        ('manager1', 'john.smith@tickethub.com', 'John', 'Smith'),
        ('manager2', 'sarah.johnson@tickethub.com', 'Sarah', 'Johnson'),
        ('manager3', 'david.williams@tickethub.com', 'David', 'Williams'),
    ]
    
    users['managers'] = []
    for username, email, first_name, last_name in manager_data:
        manager = create_user(username, email, 'manager123', 'manager', first_name, last_name)
        users['managers'].append(manager)
    
    # Employee users
    employee_data = [
        ('employee1', 'mike.brown@tickethub.com', 'Mike', 'Brown'),
        ('employee2', 'emily.jones@tickethub.com', 'Emily', 'Jones'),
        ('employee3', 'robert.garcia@tickethub.com', 'Robert', 'Garcia'),
        ('employee4', 'lisa.miller@tickethub.com', 'Lisa', 'Miller'),
        ('employee5', 'james.davis@tickethub.com', 'James', 'Davis'),
        ('employee6', 'maria.wilson@tickethub.com', 'Maria', 'Wilson'),
    ]
    
    users['employees'] = []
    for username, email, first_name, last_name in employee_data:
        employee = create_user(username, email, 'employee123', 'employee', first_name, last_name)
        users['employees'].append(employee)
    
    return users


def create_projects(users):
    """Create realistic projects."""
    print("\n=== Creating Projects ===")
    
    projects = []
    all_managers = users['managers']
    all_employees = users['employees']
    
    for i, (name, description) in enumerate(zip(PROJECT_NAMES, PROJECT_DESCRIPTIONS)):
        # Assign a manager as the creator
        manager = all_managers[i % len(all_managers)]
        
        project = Project.objects.create(
            name=name,
            description=description,
            status='active',
            created_by=manager
        )
        print(f"Created project: {name}")
        
        # Add all managers to the project
        for m in all_managers:
            ProjectMember.objects.get_or_create(project=project, user=m)
        
        # Add some employees to the project (randomly 3-5 employees per project)
        num_members = random.randint(3, min(5, len(all_employees)))
        selected_employees = random.sample(all_employees, num_members)
        for emp in selected_employees:
            ProjectMember.objects.get_or_create(project=project, user=emp)
        
        projects.append(project)
    
    return projects


def create_tickets(projects, users):
    """Create realistic tickets."""
    print("\n=== Creating Tickets ===")
    
    tickets = []
    all_managers = users['managers']
    all_employees = users['employees']
    all_users = all_managers + all_employees
    
    ticket_types = ['bug', 'task', 'feature']
    priorities = ['low', 'medium', 'high', 'critical']
    statuses = ['new', 'in_progress', 'qa', 'closed', 'reopened']
    
    # Create tickets for each project
    for project in projects:
        num_tickets = random.randint(8, 15)
        project_users = list(project.members.all())
        
        for _ in range(num_tickets):
            title = random.choice(TICKET_TITLES)
            description = random.choice(TICKET_DESCRIPTIONS)
            
            # Try to create ticket with unique ID, retry if collision
            max_retries = 10
            for attempt in range(max_retries):
                try:
                    ticket = Ticket.objects.create(
                        title=f"{title} - {random.randint(1, 999)}",
                        description=description,
                        type=random.choice(ticket_types),
                        priority=random.choice(priorities),
                        status=random.choice(statuses),
                        project=project,
                        created_by=random.choice(project_users),
                        assignee=random.choice(project_users) if random.random() > 0.1 else None
                    )
                    print(f"Created ticket: {ticket.ticket_id}")
                    tickets.append((ticket, project_users))
                    break
                except Exception as e:
                    if 'duplicate key' in str(e).lower() and attempt < max_retries - 1:
                        continue
                    else:
                        raise
    
    return tickets


def create_comments(tickets_data):
    """Create comments for tickets."""
    print("\n=== Creating Comments ===")
    
    for ticket, project_users in tickets_data:
        # Add 1-4 comments per ticket
        num_comments = random.randint(1, 4)
        
        for _ in range(num_comments):
            Comment.objects.create(
                ticket=ticket,
                author=random.choice(project_users),
                content=random.choice(COMMENT_TEMPLATES)
            )
    
    print(f"Created comments for {len(tickets_data)} tickets")


def create_work_logs(tickets_data):
    """Create work logs for tickets."""
    print("\n=== Creating Work Logs ===")
    
    now = timezone.now()
    
    for ticket, project_users in tickets_data:
        # Only add work logs for assigned and non-closed tickets
        if ticket.assignee and ticket.status != 'closed' and random.random() > 0.3:
            # Add 1-3 work log entries
            num_logs = random.randint(1, 3)
            
            for i in range(num_logs):
                start_time = now - timedelta(days=random.randint(1, 10))
                duration = random.randint(30, 240)  # 30 mins to 4 hours
                end_time = start_time + timedelta(minutes=duration)
                
                WorkLog.objects.create(
                    ticket=ticket,
                    user=ticket.assignee,
                    start_time=start_time,
                    end_time=end_time,
                    notes=random.choice(WORK_LOG_NOTES)
                )
    
    print("Created work logs for tickets")


def create_activity_logs(tickets_data, projects, users):
    """Create activity logs for various actions."""
    print("\n=== Creating Activity Logs ===")
    
    now = timezone.now()
    ticket_content_type = ContentType.objects.get_for_model(Ticket)
    project_content_type = ContentType.objects.get_for_model(Project)
    
    # Log ticket activities
    for ticket, project_users in tickets_data:
        # Create a few activity logs per ticket
        num_activities = random.randint(2, 5)
        
        for _ in range(num_activities):
            action = random.choice([
                'create', 'update', 'status_change', 
                'assignment_change', 'comment', 'work_log'
            ])
            
            descriptions = {
                'create': f'Created ticket {ticket.ticket_id}',
                'update': f'Updated ticket {ticket.ticket_id}',
                'status_change': f'Changed status of {ticket.ticket_id} to {ticket.status}',
                'assignment_change': f'Assigned {ticket.ticket_id} to {ticket.assignee.username if ticket.assignee else "Unassigned"}',
                'comment': f'Added comment to ticket {ticket.ticket_id}',
                'work_log': f'Logged work on ticket {ticket.ticket_id}',
            }
            
            ActivityLog.objects.create(
                action=action,
                user=random.choice(project_users),
                content_type=ticket_content_type,
                object_id=ticket.id,
                description=descriptions[action],
                extra_data={
                    'ticket_id': ticket.ticket_id,
                    'status': ticket.status,
                    'priority': ticket.priority,
                }
            )
    
    # Log project activities
    for project in projects:
        for _ in range(random.randint(1, 3)):
            ActivityLog.objects.create(
                action='create',
                user=project.created_by,
                content_type=project_content_type,
                object_id=project.id,
                description=f'Created project {project.name}',
                extra_data={
                    'project_name': project.name,
                    'status': project.status,
                }
            )
    
    print("Created activity logs")


def print_summary(users, projects):
    """Print a summary of created data."""
    print("\n" + "="*50)
    print("POPULATION SUMMARY")
    print("="*50)
    
    print(f"\nUsers created:")
    print(f"  Admin: 1")
    print(f"  Managers: {len(users['managers'])}")
    print(f"  Employees: {len(users['employees'])}")
    print(f"  Total: {1 + len(users['managers']) + len(users['employees'])}")
    
    print(f"\nProjects created: {Project.objects.count()}")
    print(f"Tickets created: {Ticket.objects.count()}")
    print(f"Comments created: {Comment.objects.count()}")
    print(f"Work logs created: {WorkLog.objects.count()}")
    print(f"Activity logs created: {ActivityLog.objects.count()}")
    
    print("\n" + "="*50)
    print("LOGIN CREDENTIALS")
    print("="*50)
    
    print("\nAdmin:")
    print("  Username: admin")
    print("  Password: admin123")
    
    print("\nManagers:")
    for manager in users['managers']:
        print(f"  Username: {manager.username}")
        print("  Password: manager123")
    
    print("\nEmployees (first 3):")
    for i, employee in enumerate(users['employees'][:3]):
        print(f"  Username: {employee.username}")
        print("  Password: employee123")
    
    print("\n" + "="*50)
    print("Database population completed successfully!")
    print("="*50 + "\n")


def main():
    """Main function to populate the database."""
    print("\nStarting TicketHub database population...")
    print("="*50)
    
    # Create users
    users = create_users()
    
    # Create projects
    projects = create_projects(users)
    
    # Create tickets
    tickets_data = create_tickets(projects, users)
    
    # Create comments
    create_comments(tickets_data)
    
    # Create work logs
    create_work_logs(tickets_data)
    
    # Create activity logs
    create_activity_logs(tickets_data, projects, users)
    
    # Print summary
    print_summary(users, projects)


if __name__ == '__main__':
    main()
else:
    main()
