from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.utils import timezone
from .models import Ticket
from .serializers import (
    TicketSerializer, 
    TicketCreateSerializer, 
    TicketUpdateSerializer,
    TicketStatusSerializer
)
from apps.users.permissions import IsManagerOrAdmin
from apps.projects.models import Project
from apps.timelogs.models import WorkLog
from apps.activity.utils import log_activity


class IsCreatorOrManagerOrAdmin(IsAuthenticated):
    """
    Permission that allows:
    - Admin: full access
    - Manager: full access
    - Creator: can edit/delete their own tickets
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        # Admin and Manager have full access
        if user.role in ['admin', 'manager']:
            return True
        # Creator can edit their own tickets
        return obj.created_by == user


class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'type', 'project']
    search_fields = ['ticket_id', 'title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'priority']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        elif self.action == 'partial_update':
            return TicketUpdateSerializer
        return TicketSerializer
    
    def get_permissions(self):
        """Instantiate and return the list of permissions for the view."""
        if self.action in ['update', 'partial_update', 'destroy']:
            # Only creator, manager, or admin can edit/delete
            return [IsAuthenticated(), IsCreatorOrManagerOrAdmin()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin sees all tickets
        if user.role == 'admin':
            return Ticket.objects.all()
        
        # Manager sees tickets for projects they manage or are members of
        if user.role == 'manager':
            return Ticket.objects.filter(
                Q(project__created_by=user) | 
                Q(project__members=user) |
                Q(assignee=user) |
                Q(created_by=user)
            ).distinct()
        
        # Employee sees tickets assigned to them or in projects they are members of
        return Ticket.objects.filter(
            Q(assignee=user) |
            Q(project__members=user) |
            Q(created_by=user)
        ).distinct()
    
    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        # Log activity
        log_activity(
            action='create',
            user=self.request.user,
            instance=ticket,
            description=f"Created ticket {ticket.ticket_id}: {ticket.title}"
        )
    
    def perform_update(self, serializer):
        old_data = self.get_object()
        ticket = serializer.save()
        
        # Check what changed
        changes = []
        if old_data.title != ticket.title:
            changes.append(f"title from '{old_data.title}' to '{ticket.title}'")
        if old_data.description != ticket.description:
            changes.append("description")
        if old_data.status != ticket.status:
            changes.append(f"status from '{old_data.status}' to '{ticket.status}'")
        if old_data.priority != ticket.priority:
            changes.append(f"priority from '{old_data.priority}' to '{ticket.priority}'")
        if old_data.assignee != ticket.assignee:
            old_assignee = old_data.assignee.username if old_data.assignee else "Unassigned"
            new_assignee = ticket.assignee.username if ticket.assignee else "Unassigned"
            changes.append(f"assignee from '{old_assignee}' to '{new_assignee}'")
        
        if changes:
            log_activity(
                action='update',
                user=self.request.user,
                instance=ticket,
                description=f"Updated ticket {ticket.ticket_id}: {', '.join(changes)}"
            )
    
    def perform_destroy(self, instance):
        log_activity(
            action='delete',
            user=self.request.user,
            description=f"Deleted ticket {instance.ticket_id}: {instance.title}"
        )
        instance.delete()
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        ticket = self.get_object()
        serializer = TicketStatusSerializer(ticket, data=request.data, partial=True)
        
        if serializer.is_valid():
            old_status = ticket.status
            new_status = serializer.validated_data['status']
            user = request.user
            
            # Validate status transition
            valid_transitions = self._get_valid_transitions(old_status)
            if new_status not in valid_transitions:
                return Response(
                    {'error': f'Cannot transition from {old_status} to {new_status}. Valid transitions: {valid_transitions}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Handle automatic work log management
            self._handle_work_log_on_status_change(ticket, old_status, new_status, user)
            
            serializer.save()
            
            # Log status change activity
            log_activity(
                action='status_change',
                user=user,
                instance=ticket,
                description=f"Changed ticket {ticket.ticket_id} status from '{old_status}' to '{new_status}'",
                extra_data={'old_status': old_status, 'new_status': new_status}
            )
            
            return Response(TicketSerializer(ticket).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def _get_valid_transitions(self, current_status):
        """Define valid status transitions - linear workflow"""
        transitions = {
            'new': ['in_progress'],
            'in_progress': ['qa'],
            'qa': ['closed'],
            'closed': ['reopened'],
            'reopened': ['new', 'in_progress'],
        }
        return transitions.get(current_status, [])
    
    def _handle_work_log_on_status_change(self, ticket, old_status, new_status, user):
        """Automatically manage work logs based on status changes"""
        
        # Stop any active work log when ticket is closed
        if new_status == 'closed':
            active_log = WorkLog.objects.filter(
                ticket=ticket,
                end_time__isnull=True
            ).first()
            
            if active_log:
                active_log.end_time = timezone.now()
                active_log.save()
        
        # Start a new work log when ticket becomes in_progress
        elif new_status == 'in_progress' and old_status in ['new', 'reopened']:
            # Check if there's already an active work log for this ticket
            existing_active = WorkLog.objects.filter(
                ticket=ticket,
                end_time__isnull=True
            ).first()
            
            if not existing_active:
                WorkLog.objects.create(
                    ticket=ticket,
                    user=user,
                    start_time=timezone.now()
                )
        
        # Start a new work log when ticket is reopened
        elif new_status == 'reopened' and old_status == 'closed':
            # Create a new work log session for the reopened ticket
            WorkLog.objects.create(
                ticket=ticket,
                user=user,
                start_time=timezone.now()
            )
    
    @action(detail=False, methods=['get'])
    def my_tickets(self, request):
        """Get tickets assigned to the current user"""
        tickets = Ticket.objects.filter(assignee=request.user)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_project(self, request):
        """Get tickets filtered by project"""
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tickets = self.get_queryset().filter(project_id=project_id)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
