from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q, Sum, Avg
from django.utils import timezone
from datetime import timedelta

from apps.users.models import User
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.timelogs.models import WorkLog
from apps.activity.models import ActivityLog


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_dashboard(request):
    """
    Employee Dashboard:
    - Assigned tickets
    - Tickets in progress
    - Recent activity
    """
    user = request.user
    
    # Get assigned tickets
    assigned_tickets = Ticket.objects.filter(assignee=user)
    
    # Tickets by status
    tickets_by_status = assigned_tickets.values('status').annotate(
        count=Count('id')
    ).order_by('status')
    
    # In progress tickets (assigned to user and status is 'in_progress')
    in_progress_tickets = assigned_tickets.filter(status='in_progress').select_related('project')
    
    # Recent activity (last 10 activities)
    recent_activity = ActivityLog.objects.filter(
        user=user
    ).select_related('content_type').order_by('-created_at')[:10]
    
    # Total time logged (in minutes)
    total_time = WorkLog.objects.filter(
        user=user,
        end_time__isnull=False
    ).aggregate(total=Sum('duration_minutes'))['total'] or 0
    
    # Active work session
    active_session = WorkLog.objects.filter(
        user=user,
        end_time__isnull=True
    ).select_related('ticket').first()
    
    # Tickets due soon (created more than 7 days ago and still open)
    week_ago = timezone.now() - timedelta(days=7)
    tickets_due_soon = assigned_tickets.filter(
        created_at__lte=week_ago,
        status__in=['new', 'in_progress', 'qa']
    ).count()
    
    return Response({
        'assigned_tickets_count': assigned_tickets.count(),
        'in_progress_count': assigned_tickets.filter(status='in_progress').count(),
        'completed_tickets_count': assigned_tickets.filter(status='closed').count(),
        'tickets_by_status': {item['status']: item['count'] for item in tickets_by_status},
        'in_progress_tickets': [
            {
                'id': t.id,
                'ticket_id': t.ticket_id,
                'title': t.title,
                'project_name': t.project.name if t.project else None,
                'priority': t.priority,
                'created_at': t.created_at,
            }
            for t in in_progress_tickets
        ],
        'recent_activity': [
            {
                'id': a.id,
                'action': a.action,
                'description': a.description,
                'created_at': a.created_at,
            }
            for a in recent_activity
        ],
        'total_time_logged_hours': round(total_time / 60, 2),
        'active_session': {
            'id': active_session.ticket.id,
            'ticket_id': active_session.ticket.ticket_id,
            'ticket_title': active_session.ticket.title,
            'start_time': active_session.start_time,
        } if active_session else None,
        'tickets_due_soon': tickets_due_soon,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_dashboard(request):
    """
    Manager Dashboard:
    - Project overview
    - Ticket distribution by status
    - Time spent per ticket
    - Team workload snapshot
    """
    user = request.user
    
    # Projects managed by this user
    managed_projects = Project.objects.filter(
        Q(created_by=user) | Q(members=user)
    ).distinct()
    
    # Active vs Archived projects
    active_projects = managed_projects.filter(status='active')
    archived_projects = managed_projects.filter(status='archived')
    
    # All tickets in managed projects
    project_tickets = Ticket.objects.filter(project__in=managed_projects)
    
    # Ticket distribution by status
    tickets_by_status = project_tickets.values('status').annotate(
        count=Count('id')
    ).order_by('status')
    
    # Ticket distribution by priority
    tickets_by_priority = project_tickets.values('priority').annotate(
        count=Count('id')
    ).order_by('priority')
    
    # Time spent per project
    project_time_data = []
    for project in active_projects:
        project_tickets_qs = Ticket.objects.filter(project=project)
        total_minutes = WorkLog.objects.filter(
            ticket__in=project_tickets_qs,
            end_time__isnull=False
        ).aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        project_time_data.append({
            'project_id': project.id,
            'project_name': project.name,
            'total_hours': round(total_minutes / 60, 2),
            'ticket_count': project_tickets_qs.count(),
        })
    
    # Team workload - tickets assigned to each team member
    team_workload = []
    for project in active_projects:
        members = project.members.all()
        for member in members:
            member_tickets = Ticket.objects.filter(
                project=project,
                assignee=member
            )
            team_workload.append({
                'user_id': member.id,
                'user_name': f"{member.first_name} {member.last_name}".strip() or member.username,
                'project_id': project.id,
                'project_name': project.name,
                'assigned_tickets': member_tickets.count(),
                'in_progress': member_tickets.filter(status='in_progress').count(),
            })
    
    # Recent tickets in managed projects
    recent_tickets = project_tickets.select_related('project', 'assignee').order_by('-created_at')[:10]
    
    # Unassigned tickets count
    unassigned_tickets = project_tickets.filter(assignee__isnull=True).count()
    
    return Response({
        'total_projects': managed_projects.count(),
        'active_projects': active_projects.count(),
        'archived_projects': archived_projects.count(),
        'total_tickets': project_tickets.count(),
        'tickets_by_status': {item['status']: item['count'] for item in tickets_by_status},
        'tickets_by_priority': {item['priority']: item['count'] for item in tickets_by_priority},
        'project_time_data': project_time_data,
        'team_workload': team_workload,
        'recent_tickets': [
            {
                'id': t.id,
                'ticket_id': t.ticket_id,
                'title': t.title,
                'project_name': t.project.name if t.project else None,
                'assignee_name': f"{t.assignee.first_name} {t.assignee.last_name}".strip() if t.assignee else 'Unassigned',
                'status': t.status,
                'priority': t.priority,
                'created_at': t.created_at,
            }
            for t in recent_tickets
        ],
        'unassigned_tickets': unassigned_tickets,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    Admin Dashboard:
    - User count
    - Active projects count
    - System metrics
    """
    user = request.user
    
    # Only admin can access
    if user.role != 'admin':
        return Response({'error': 'Permission denied'}, status=403)
    
    # User statistics
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    users_by_role = User.objects.values('role').annotate(
        count=Count('id')
    ).order_by('role')
    
    # Recent users (last 7 days)
    week_ago = timezone.now() - timedelta(days=7)
    recent_users = User.objects.filter(
        date_joined__gte=week_ago
    ).count()
    
    # Project statistics
    total_projects = Project.objects.count()
    active_projects = Project.objects.filter(status='active').count()
    archived_projects = Project.objects.filter(status='archived').count()
    
    # Ticket statistics
    total_tickets = Ticket.objects.count()
    tickets_by_status = Ticket.objects.values('status').annotate(
        count=Count('id')
    ).order_by('status')
    
    # Recent tickets (last 7 days)
    recent_tickets = Ticket.objects.filter(
        created_at__gte=week_ago
    ).count()
    
    # Work log statistics
    total_work_logs = WorkLog.objects.count()
    total_time_logged = WorkLog.objects.filter(
        end_time__isnull=False
    ).aggregate(total=Sum('duration_minutes'))['total'] or 0
    
    # Activity statistics
    recent_activity = ActivityLog.objects.filter(
        created_at__gte=week_ago
    ).count()
    
    # Activity by action type
    activity_by_type = ActivityLog.objects.values('action').annotate(
        count=Count('id')
    ).order_by('-count')[:5]
    
    return Response({
        'users': {
            'total': total_users,
            'active': active_users,
            'recent': recent_users,
            'by_role': {item['role']: item['count'] for item in users_by_role},
        },
        'projects': {
            'total': total_projects,
            'active': active_projects,
            'archived': archived_projects,
        },
        'tickets': {
            'total': total_tickets,
            'recent': recent_tickets,
            'by_status': {item['status']: item['count'] for item in tickets_by_status},
        },
        'work_logs': {
            'total': total_work_logs,
            'total_hours': round(total_time_logged / 60, 2),
        },
        'activity': {
            'recent_count': recent_activity,
            'by_type': {item['action']: item['count'] for item in activity_by_type},
        },
    })


# Import Q at the end to avoid circular imports
from django.db.models import Q
