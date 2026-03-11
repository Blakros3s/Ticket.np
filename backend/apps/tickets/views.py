from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, NumberFilter, CharFilter
from django.db.models import Q
from django.utils import timezone
from .models import Ticket


class TicketFilter(FilterSet):
    assignee = NumberFilter(field_name='assignees', lookup_expr='exact')

    class Meta:
        model = Ticket
        fields = ['status', 'priority', 'type', 'project']
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
    filterset_class = TicketFilter
    search_fields = ['ticket_id', 'title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'priority']
    ordering = ['-created_at']
    lookup_field = 'id'
    
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
                Q(assignees=user) |
                Q(created_by=user)
            ).distinct()
        
        # Employee sees tickets assigned to them or in projects they are members of
        return Ticket.objects.filter(
            Q(assignees=user) |
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
        old_assignee_ids = set(old_data.assignees.values_list('id', flat=True))
        new_assignee_ids = set(ticket.assignees.values_list('id', flat=True))
        if old_assignee_ids != new_assignee_ids:
            old_names = ', '.join(u.username for u in old_data.assignees.all()) or 'Unassigned'
            new_names = ', '.join(u.username for u in ticket.assignees.all()) or 'Unassigned'
            changes.append(f"assignees from '{old_names}' to '{new_names}'")
        
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
    def update_status(self, request, id=None):
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
            
            # Require at least one assignee to move to in_progress
            if new_status == 'in_progress' and not ticket.assignees.exists():
                return Response(
                    {'error': 'Cannot move to In Progress without an assignee. Please assign the ticket first.'},
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
            'reopened': ['in_progress'],
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
                
                log_activity(
                    action='work_log',
                    user=active_log.user,
                    instance=ticket,
                    description=f"Work session ended (ticket closed) - {active_log.duration_minutes} minutes logged"
                )
        
        # Start a new work log when ticket becomes in_progress
        elif new_status == 'in_progress' and old_status in ['new', 'reopened']:
            # Check if there's already an active work log for this ticket
            existing_active = WorkLog.objects.filter(
                ticket=ticket,
                end_time__isnull=True
            ).first()
            
            if not existing_active:
                work_log = WorkLog.objects.create(
                    ticket=ticket,
                    user=user,
                    start_time=timezone.now()
                )
                
                log_activity(
                    action='work_log',
                    user=user,
                    instance=ticket,
                    description=f"Work session started"
                )
        
        # Handle reopened status - clear assignees so anyone can pick it up
        elif new_status == 'reopened' and old_status == 'closed':
            ticket.assignees.clear()
            ticket.save()
            
            log_activity(
                action='status_change',
                user=user,
                instance=ticket,
                description=f"Ticket reopened - assignees cleared, ready for new assignment"
            )
    
    @action(detail=False, methods=['get'])
    def my_tickets(self, request):
        """Get tickets assigned to the current user"""
        tickets = Ticket.objects.filter(assignees=request.user)
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
    
    @action(detail=True, methods=['post'])
    def assign_ticket(self, request, id=None):
        """
        Add a user to ticket assignees. Only project members can be assigned.
        - Manager/Admin: can assign anyone (project members only)
        - Ticket creator: can assign anyone (project members only)
        - Project member: can assign other project members
        """
        ticket = self.get_object()
        user = request.user
        target_user_id = request.data.get('user_id')
        
        if not target_user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            target_user_id = int(target_user_id)
        except (ValueError, TypeError):
            return Response(
                {'error': 'user_id must be a valid integer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.users.models import User
        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        is_manager_or_admin = user.role in ['admin', 'manager']
        is_creator = ticket.created_by_id == user.id
        is_project_member = ticket.project.members.filter(id=user.id).exists()
        
        if not is_manager_or_admin and not is_creator and not is_project_member:
            return Response(
                {'error': 'Only project members, managers, admins, or ticket creators can assign tickets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only project members can be assigned
        target_is_member = ticket.project.members.filter(id=target_user.id).exists() or target_user.role in ['admin', 'manager']
        if not target_is_member:
            return Response(
                {'error': 'Only project members can be assigned to tickets.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add user to assignees (idempotent - add() ignores if already present)
        ticket.assignees.add(target_user)
        
        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Assigned ticket {ticket.ticket_id} to {target_user.username}"
        )
        
        # Notify the assigned user (when assigned by someone else)
        if target_user.id != user.id:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=target_user,
                message=f"You were assigned to ticket {ticket.ticket_id} by {user.username}",
                ticket_id=ticket.id,
                ticket_title=ticket.title[:255],
            )
        
        return Response(TicketSerializer(ticket).data)
    
    @action(detail=True, methods=['post'])
    def unassign(self, request, id=None):
        """Remove a user from ticket assignees. user_id in body, or omit to remove self."""
        ticket = self.get_object()
        user = request.user
        target_user_id = request.data.get('user_id')
        
        if target_user_id is not None:
            try:
                target_user_id = int(target_user_id)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'user_id must be a valid integer'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            from apps.users.models import User
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            target_user = user  # Remove self
        
        is_manager_or_admin = user.role in ['admin', 'manager']
        is_creator = ticket.created_by_id == user.id
        is_project_member = ticket.project.members.filter(id=user.id).exists()
        
        # Can only unassign self unless manager/creator
        if target_user.id != user.id and not is_manager_or_admin and not is_creator:
            return Response(
                {'error': 'Only managers or ticket creators can remove other assignees.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        ticket.assignees.remove(target_user)
        
        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Removed {target_user.username} from ticket {ticket.ticket_id}"
        )
        
        return Response(TicketSerializer(ticket).data)
    
    @action(detail=True, methods=['post'])
    def self_assign(self, request, id=None):
        """Allow project member to self-assign (add themselves to assignees). Multiple people can self-assign."""
        ticket = self.get_object()
        user = request.user
        
        is_member = ticket.project.members.filter(id=user.id).exists() or user.role in ['admin', 'manager']
        if not is_member:
            return Response(
                {'error': 'Only project members can self-assign tickets.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Add user to assignees - multiple people can self-assign
        ticket.assignees.add(user)
        
        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Self-assigned ticket {ticket.ticket_id}"
        )
        
        return Response(TicketSerializer(ticket).data)
    
    @action(detail=True, methods=['post'], url_path='media')
    def upload_media(self, request, id=None):
        """Upload media file to a ticket - any project member can upload"""
        try:
            ticket = self.get_object()
        except Exception as e:
            return Response(
                {'error': f'Ticket not found: {str(e)}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        is_member = ticket.project.members.filter(id=user.id).exists() or user.role in ['admin', 'manager']
        if not is_member:
            return Response(
                {'error': 'You must be a member of this project to upload files.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .models import TicketMedia
        media = TicketMedia.objects.create(
            ticket=ticket,
            file=file,
            file_name=file.name,
            file_size=file.size,
            uploaded_by=user
        )
        
        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Uploaded attachment: {file.name}"
        )
        
        from .serializers import TicketMediaSerializer
        return Response(TicketMediaSerializer(media).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['delete'], url_path=r'media/(?P<media_id>\d+)')
    def delete_media(self, request, id=None, media_id=None):
        """Delete a media file from a ticket - only creator, manager, admin can delete"""
        ticket = self.get_object()
        user = request.user
        
        from .models import TicketMedia
        try:
            media = TicketMedia.objects.get(id=media_id, ticket=ticket)
        except TicketMedia.DoesNotExist:
            return Response(
                {'error': 'Media not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        can_delete = user.role in ['admin', 'manager'] or ticket.created_by_id == user.id
        if not can_delete:
            return Response(
                {'error': 'Only managers, admins, or ticket creators can delete attachments.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        file_name = media.file_name
        media.delete()
        
        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Deleted attachment: {file_name}"
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, id=None):
        """Get or create comments for a ticket"""
        ticket = self.get_object()
        
        if request.method == 'GET':
            from apps.comments.models import Comment
            from .serializers import TicketCommentSerializer
            comments = Comment.objects.filter(ticket=ticket).order_by('created_at')
            serializer = TicketCommentSerializer(comments, many=True)
            return Response(serializer.data)
            
        elif request.method == 'POST':
            content = request.data.get('content')
            if not content:
                return Response(
                    {'error': 'Content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            from apps.comments.models import Comment
            from .serializers import TicketCommentSerializer
            
            comment = Comment.objects.create(
                ticket=ticket,
                author=request.user,
                content=content
            )
            
            log_activity(
                action='update',
                user=request.user,
                instance=ticket,
                description="Added a comment"
            )
            
            return Response(TicketCommentSerializer(comment).data, status=status.HTTP_201_CREATED)
