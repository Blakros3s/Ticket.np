# Database Population Guide

This guide explains how to populate the TicketHub database with realistic dummy data for testing and demo purposes.

## Overview

The `populate.py` script creates:
- **Users**: 1 admin, 3 managers, 6 employees (total 10 users)
- **Projects**: 10 realistic projects with descriptions
- **Tickets**: 80-150 tickets across all projects with various types, priorities, and statuses
- **Comments**: Multiple comments on tickets
- **Work Logs**: Time tracking entries for assigned tickets
- **Activity Logs**: System activity tracking for all actions

## Prerequisites

- Docker containers must be running (`docker-compose up -d`)
- Database migrations must be applied

## Usage

### Running the Populate Script

Run the script from the `backend` directory:

```bash
# Using Docker Compose (recommended)
docker-compose exec backend python manage.py shell < populate.py

# Or if you're in the backend directory
cd backend
python manage.py shell < populate.py
```

### What Gets Created

#### Users

The script creates the following users:

**Admin:**
- Username: `admin`
- Password: `admin123`

**Managers:**
- Username: `manager1` - `manager3`
- Password: `manager123`

**Employees:**
- Username: `employee1` - `employee6`
- Password: `employee123`

All users have realistic names and email addresses like `john.smith@tickethub.com`.

#### Projects

10 realistic projects including:
- Website Redesign
- Mobile App Development
- API Integration
- E-commerce Platform
- Customer Portal
- Analytics Dashboard
- Payment Gateway Integration
- User Management System
- Email Service Enhancement
- Security Audit

#### Tickets

Each project gets 8-15 tickets with:
- **Types**: Bug, Task, Feature
- **Priorities**: Low, Medium, High, Critical
- **Statuses**: New, In Progress, QA, Closed, Reopened

Ticket examples:
- "Login page authentication fails"
- "Dashboard loading slow"
- "Add export to CSV functionality"
- "Fix responsive layout issues"

#### Comments

1-4 comments per ticket with realistic content like:
- "I have started working on this issue."
- "Found the root cause. The problem is in the authentication service."
- "I have tested the fix and it seems to be working correctly."

#### Work Logs

Time tracking entries for assigned tickets:
- Duration: 30 minutes to 4 hours per entry
- 1-3 work log entries per ticket
- Realistic notes describing the work done

#### Activity Logs

System activity tracking for:
- Ticket creation
- Ticket updates
- Status changes
- Assignment changes
- Comments added
- Work logged
- Project creation

## Customization

### Modifying Data

To customize the generated data, edit the `populate.py` file:

**Change user count:**
```python
# Add more users to the employee_data list
employee_data = [
    ('employee7', 'new.user@tickethub.com', 'New', 'User'),
    # Add more...
]
```

**Change project names:**
```python
PROJECT_NAMES = [
    'Your Project Name 1',
    'Your Project Name 2',
    # Add more...
]
```

**Change ticket titles:**
```python
TICKET_TITLES = [
    'Your custom ticket title 1',
    'Your custom ticket title 2',
    # Add more...
]
```

### Start Fresh

If you want to clear all existing data before populating, uncomment these lines at the top of `populate.py`:

```python
User.objects.exclude(username='admin').delete()
Project.objects.all().delete()
Ticket.objects.all().delete()
Comment.objects.all().delete()
WorkLog.objects.all().delete()
ActivityLog.objects.all().delete()
```

## Using the Data

### Login to the Application

1. Open http://localhost:3000 in your browser
2. Use any of the credentials provided in the populate summary
3. Explore the dashboard, projects, and tickets

### Access Django Admin

1. Go to http://localhost:8000/admin/
2. Login with admin credentials (admin/admin123)
3. View and manage all created data

### API Access

You can also access the data via the REST API:

```bash
# Get all projects
curl http://localhost:8000/api/projects/

# Get tickets for a project
curl http://localhost:8000/api/tickets/?project=1

# Get user list
curl http://localhost:8000/api/auth/users/
```

## Troubleshooting

### Script Doesn't Run

Make sure Docker containers are running:
```bash
docker-compose ps
```

If containers are not running, start them:
```bash
docker-compose up -d
```

### Database Locked

If you see database locked errors, wait a few seconds and try again. The issue usually resolves itself.

### Permission Errors

Ensure the script has execute permissions:
```bash
chmod +x backend/populate.py
```

## Data Structure

### User Roles

- **Admin**: Full system access
- **Manager**: Can create projects, assign tickets, manage team
- **Employee**: Can create tickets, view assigned tickets, log time

### Ticket Workflow

1. **New**: Ticket created, not yet assigned
2. **In Progress**: Someone is working on it
3. **QA**: Ready for quality assurance testing
4. **Closed**: Resolved and completed
5. **Reopened**: Issues found after closing, needs attention

## Performance Considerations

- The script creates a significant amount of data (1000+ records)
- First run may take 10-30 seconds
- Subsequent runs may take less time due to caching
- For smaller datasets, reduce the random ranges in the script

## Clean Up

To remove all test data while keeping the admin user:

```bash
docker-compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.comments.models import Comment
from apps.timelogs.models import WorkLog
from apps.activity.models import ActivityLog

User = get_user_model()

# Delete all data except admin
User.objects.exclude(username='admin').delete()
Project.objects.all().delete()
Ticket.objects.all().delete()
Comment.objects.all().delete()
WorkLog.objects.all().delete()
ActivityLog.objects.all().delete()

print('All test data removed!')
"
```

## Support

For issues or questions:
1. Check Docker logs: `docker-compose logs backend`
2. Review the script: `cat backend/populate.py`
3. Verify database: `docker-compose exec backend python manage.py dbshell`

## Next Steps

After populating the database:

1. Test the application features with realistic data
2. Try different user roles and permissions
3. Create additional tickets and workflows
4. Test the ticket assignment and status change features
5. Explore the analytics and reporting capabilities

---

**Note**: This script is designed for development and testing purposes. Do not use it in production environments.
