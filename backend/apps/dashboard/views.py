from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q, Sum, Avg
from django.utils import timezone
from datetime import timedelta
from collections import OrderedDict

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
from django.db.models.functions import TruncWeek, TruncDay


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_reports(request):
    """Employee Reports: Personal productivity and time analytics"""
    user = request.user
    
    days = int(request.query_params.get('days', 30))
    start_date = timezone.now() - timedelta(days=days)
    
    # Tickets over time (by week)
    tickets_created = Ticket.objects.filter(
        created_by=user,
        created_at__gte=start_date
    ).annotate(week=TruncWeek('created_at')).values('week').annotate(
        count=Count('id')
    ).order_by('week')
    
    tickets_completed = Ticket.objects.filter(
        assignee=user,
        status='closed',
        closed_at__gte=start_date
    ).annotate(week=TruncWeek('closed_at')).values('week').annotate(
        count=Count('id')
    ).order_by('week')
    
    # Time logged by project
    time_by_project = WorkLog.objects.filter(
        user=user,
        end_time__isnull=False,
        start_time__gte=start_date
    ).values('ticket__project__name').annotate(
        total_minutes=Sum('duration_minutes'),
        session_count=Count('id')
    ).order_by('-total_minutes')[:10]
    
    # Productivity metrics
    total_assigned = Ticket.objects.filter(assignee=user).count()
    total_completed = Ticket.objects.filter(assignee=user, status='closed').count()
    
    avg_resolution_time = WorkLog.objects.filter(
        user=user,
        end_time__isnull=False
    ).aggregate(avg=Avg('duration_minutes'))['avg'] or 0
    
    # Time trend (daily for last 14 days)
    time_trend = []
    for i in range(14):
        day = timezone.now().date() - timedelta(days=13-i)
        day_start = timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time()))
        day_end = day_start + timedelta(days=1)
        
        total_minutes = WorkLog.objects.filter(
            user=user,
            start_time__gte=day_start,
            start_time__lt=day_end,
            end_time__isnull=False
        ).aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        time_trend.append({
            'date': day.isoformat(),
            'hours': round(total_minutes / 60, 2)
        })
    
    # Priority distribution of assigned tickets
    priority_dist = Ticket.objects.filter(
        assignee=user
    ).values('priority').annotate(count=Count('id'))
    
    return Response({
        'tickets_created_over_time': [
            {'week': item['week'].strftime('%Y-%m-%d') if item['week'] else None, 'count': item['count']}
            for item in tickets_created
        ],
        'tickets_completed_over_time': [
            {'week': item['week'].strftime('%Y-%m-%d') if item['week'] else None, 'count': item['count']}
            for item in tickets_completed
        ],
        'time_by_project': [
            {
                'project_name': item['ticket__project__name'] or 'No Project',
                'total_hours': round((item['total_minutes'] or 0) / 60, 2),
                'session_count': item['session_count']
            }
            for item in time_by_project
        ],
        'productivity': {
            'total_assigned': total_assigned,
            'total_completed': total_completed,
            'completion_rate': round((total_completed / total_assigned * 100) if total_assigned > 0 else 0, 1),
            'avg_resolution_hours': round(avg_resolution_time / 60, 2)
        },
        'time_trend': time_trend,
        'priority_distribution': {item['priority']: item['count'] for item in priority_dist}
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_reports(request):
    """Manager Reports: Team performance and project analytics"""
    user = request.user
    
    if user.role not in ['admin', 'manager']:
        return Response({'error': 'Permission denied'}, status=403)
    
    days = int(request.query_params.get('days', 30))
    start_date = timezone.now() - timedelta(days=days)
    
    # Projects managed
    managed_projects = Project.objects.filter(
        Q(created_by=user) | Q(members=user)
    ).distinct()
    
    # Team performance
    team_members = User.objects.filter(
        Q(projectmember__project__in=managed_projects) | Q(role='admin')
    ).distinct()
    
    team_performance = []
    for member in team_members:
        assigned = Ticket.objects.filter(assignee=member, project__in=managed_projects)
        completed = assigned.filter(status='closed')
        time_logged = WorkLog.objects.filter(
            user=member,
            ticket__project__in=managed_projects,
            end_time__isnull=False
        ).aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        team_performance.append({
            'user_id': member.id,
            'user_name': f"{member.first_name} {member.last_name}".strip() or member.username,
            'assigned': assigned.count(),
            'completed': completed.count(),
            'in_progress': assigned.filter(status='in_progress').count(),
            'total_hours': round(time_logged / 60, 2)
        })
    
    # Project progress
    project_progress = []
    for project in managed_projects.filter(status='active'):
        tickets = Ticket.objects.filter(project=project)
        total = tickets.count()
        completed = tickets.filter(status='closed').count()
        
        project_progress.append({
            'project_id': project.id,
            'project_name': project.name,
            'total_tickets': total,
            'completed': completed,
            'progress': round((completed / total * 100) if total > 0 else 0, 1)
        })
    
    # Ticket trends (weekly)
    ticket_trends = Ticket.objects.filter(
        project__in=managed_projects,
        created_at__gte=start_date
    ).annotate(week=TruncWeek('created_at')).values('week', 'status').annotate(
        count=Count('id')
    ).order_by('week', 'status')
    
    # Organize trends
    trends = OrderedDict()
    for item in ticket_trends:
        week = item['week'].strftime('%Y-%m-%d') if item['week'] else 'Unknown'
        if week not in trends:
            trends[week] = {}
        trends[week][item['status']] = item['count']
    
    # Average resolution time by priority
    resolution_by_priority = []
    for priority in ['low', 'medium', 'high', 'critical']:
        tickets_with_time = Ticket.objects.filter(
            project__in=managed_projects,
            priority=priority,
            status='closed',
            closed_at__isnull=False
        )
        
        total_resolution_hours = 0
        count = 0
        for ticket in tickets_with_time:
            if ticket.in_progress_at and ticket.closed_at:
                delta = ticket.closed_at - ticket.in_progress_at
                total_resolution_hours += delta.total_seconds() / 3600
                count += 1
        
        resolution_by_priority.append({
            'priority': priority,
            'avg_hours': round(total_resolution_hours / count, 1) if count > 0 else 0,
            'count': count
        })
    
    return Response({
        'team_performance': sorted(team_performance, key=lambda x: x['completed'], reverse=True),
        'project_progress': project_progress,
        'ticket_trends': [{'week': k, **v} for k, v in trends.items()],
        'resolution_by_priority': resolution_by_priority,
        'period_days': days
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_reports(request):
    """Admin Reports: System-wide analytics"""
    user = request.user
    
    if user.role != 'admin':
        return Response({'error': 'Permission denied'}, status=403)
    
    days = int(request.query_params.get('days', 30))
    start_date = timezone.now() - timedelta(days=days)
    
    # User activity trends (daily)
    user_activity = ActivityLog.objects.filter(
        created_at__gte=start_date
    ).annotate(day=TruncDay('created_at')).values('day').annotate(
        count=Count('id')
    ).order_by('day')
    
    # Ticket volume trends (daily)
    ticket_volume = Ticket.objects.filter(
        created_at__gte=start_date
    ).annotate(day=TruncDay('created_at')).values('day').annotate(
        created=Count('id')
    ).order_by('day')
    
    # Closed tickets trend
    closed_volume = Ticket.objects.filter(
        closed_at__gte=start_date,
        status='closed'
    ).annotate(day=TruncDay('closed_at')).values('day').annotate(
        closed=Count('id')
    ).order_by('day')
    
    # Merge created and closed
    volume_trend = OrderedDict()
    for item in ticket_volume:
        day = item['day'].strftime('%Y-%m-%d') if item['day'] else 'Unknown'
        volume_trend[day] = {'created': item['created'], 'closed': 0}
    for item in closed_volume:
        day = item['day'].strftime('%Y-%m-%d') if item['day'] else 'Unknown'
        if day in volume_trend:
            volume_trend[day]['closed'] = item['closed']
        else:
            volume_trend[day] = {'created': 0, 'closed': item['closed']}
    
    # Project health
    projects = Project.objects.filter(status='active')
    project_health = []
    for project in projects:
        tickets = Ticket.objects.filter(project=project)
        total = tickets.count()
        open_tickets = tickets.filter(status__in=['new', 'in_progress', 'qa', 'reopened']).count()
        overdue = tickets.filter(
            created_at__lte=timezone.now() - timedelta(days=14),
            status__in=['new', 'in_progress', 'qa']
        ).count()
        
        health_score = max(0, 100 - (overdue * 10) - (open_tickets * 2 if total > 0 else 0))
        
        project_health.append({
            'project_id': project.id,
            'project_name': project.name,
            'total_tickets': total,
            'open_tickets': open_tickets,
            'overdue': overdue,
            'health_score': health_score
        })
    
    # Top performers
    top_performers = User.objects.annotate(
        tickets_closed=Count('assigned_tickets', filter=Q(assigned_tickets__status='closed')),
        total_time=Sum('worklog__duration_minutes')
    ).filter(tickets_closed__gt=0).order_by('-tickets_closed')[:10]
    
    # Activity by type
    activity_breakdown = ActivityLog.objects.filter(
        created_at__gte=start_date
    ).values('action').annotate(count=Count('id')).order_by('-count')
    
    return Response({
        'user_activity_trend': [
            {'date': item['day'].strftime('%Y-%m-%d') if item['day'] else None, 'count': item['count']}
            for item in user_activity
        ],
        'ticket_volume_trend': [
            {'date': k, **v} for k, v in volume_trend.items()
        ],
        'project_health': sorted(project_health, key=lambda x: x['health_score'], reverse=True),
        'top_performers': [
            {
                'user_id': u.id,
                'user_name': f"{u.first_name} {u.last_name}".strip() or u.username,
                'tickets_closed': u.tickets_closed,
                'total_hours': round((u.total_time or 0) / 60, 2)
            }
            for u in top_performers
        ],
        'activity_breakdown': {item['action']: item['count'] for item in activity_breakdown},
        'period_days': days,
        'summary': {
            'total_users': User.objects.count(),
            'total_projects': Project.objects.count(),
            'total_tickets': Ticket.objects.count(),
            'total_hours_logged': round((WorkLog.objects.filter(end_time__isnull=False).aggregate(t=Sum('duration_minutes'))['t'] or 0) / 60, 2)
        }
    })
