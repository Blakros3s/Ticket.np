from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, NumberFilter
from django.db.models import Q, Count
from django.utils import timezone

from apps.users.models import User
from apps.notifications.services import notify_ticket_assigned
from apps.comments.models import Comment
from apps.comments.utils import notify_comment_mentions
from apps.timelogs.models import WorkLog
from apps.activity.utils import log_activity
from apps.core.access import user_can_create_ticket_on_project

from .models import Ticket, TicketMedia
from .serializers import (
    TicketSerializer,
    TicketCreateSerializer,
    TicketUpdateSerializer,
    TicketStatusSerializer,
    TicketCommentSerializer,
    TicketMediaSerializer,
    validate_file,
    validate_image_file,
    get_file_type,
)


# ---------------------------------------------------------------------------
# Filter
# ---------------------------------------------------------------------------

class TicketFilter(FilterSet):
    assignee = NumberFilter(field_name='assignees', lookup_expr='exact')

    class Meta:
        model  = Ticket
        fields = ['status', 'priority', 'type', 'project']


TICKET_STATUS_KEYS = ('new', 'in_progress', 'qa', 'closed', 'reopened')


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class IsCreatorOrManagerOrAdmin(IsAuthenticated):
    """
    Allow full access to admins and managers.
    Allow edit/delete only to the ticket's original creator.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ['admin', 'manager']:
            return True
        return obj.created_by == user


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------

class TicketViewSet(viewsets.ModelViewSet):
    permission_classes  = [IsAuthenticated]
    filter_backends     = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class     = TicketFilter
    search_fields       = ['ticket_id', 'title', 'description']
    ordering_fields     = ['created_at', 'updated_at', 'priority']
    ordering            = ['-created_at']
    lookup_field        = 'id'
    # pagination_class    = None  # return all tickets — filtering is done client-side

    def get_serializer_class(self):
        if self.action == 'create':
            return TicketCreateSerializer
        if self.action == 'partial_update':
            return TicketUpdateSerializer
        return TicketSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update']:
            return [IsAuthenticated(), IsCreatorOrManagerOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        base_qs = self._ticket_detail_queryset()

        if user.role == 'admin':
            return base_qs.all()

        if user.role == 'manager':
            return base_qs.filter(
                Q(project__created_by=user) |
                Q(project__members=user)    |
                Q(assignees=user)           |
                Q(created_by=user)
            ).distinct()

        # Employee
        return base_qs.filter(
            Q(assignees=user)       |
            Q(project__members=user) |
            Q(created_by=user)
        ).distinct()

    def _ticket_detail_queryset(self):
        return (
            Ticket.objects
            .select_related('project', 'created_by')
            .prefetch_related('assignees', 'media_files', 'comments__author', 'comments__media_files')
        )

    def filter_queryset(self, queryset):
        """Deduplicate M2M rows without breaking PostgreSQL ORDER BY + DISTINCT."""
        queryset = super().filter_queryset(queryset)
        ordering = queryset.query.order_by or ('-created_at',)

        distinct_pks = queryset.order_by().values('pk').distinct()

        return (
            self._ticket_detail_queryset()
            .filter(pk__in=distinct_pks)
            .order_by(*ordering)
        )

    def _queryset_without_status_filter(self):
        """Apply the same filters as list, excluding status."""
        queryset = self.get_queryset()
        filter_params = self.request.query_params.copy()
        filter_params.pop('status', None)

        if self.filterset_class:
            filterset = self.filterset_class(
                filter_params, queryset=queryset, request=self.request
            )
            if filterset.is_valid():
                queryset = filterset.qs

        for backend in list(self.filter_backends):
            if backend is filters.SearchFilter:
                queryset = backend().filter_queryset(
                    self.request, queryset, self
                )

        # Collapse to distinct ticket IDs so M2M joins cannot inflate counts.
        return Ticket.objects.filter(pk__in=queryset.values('pk').distinct())

    # ------------------------------------------------------------------
    # Standard CRUD hooks
    # ------------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        ticket = serializer.instance
        output = TicketSerializer(ticket, context=self.get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        project = serializer.validated_data['project']
        if not user_can_create_ticket_on_project(self.request.user, project):
            raise PermissionDenied('You must be a project member to create tickets on this project.')

        ticket = serializer.save(created_by=self.request.user)
        try:
            log_activity(
                action='create',
                user=self.request.user,
                instance=ticket,
                description=f"Created ticket {ticket.ticket_id}: {ticket.title}",
            )
        except Exception:
            pass
        for assignee in ticket.assignees.all():
            notify_ticket_assigned(
                assignee=assignee,
                ticket=ticket,
                assigned_by=self.request.user,
            )

    def perform_update(self, serializer):
        old = self.get_object()
        old_ids = set(old.assignees.values_list('id', flat=True))
        ticket = serializer.save()

        new_ids = set(ticket.assignees.values_list('id', flat=True))
        new_assignee_ids = new_ids - old_ids
        if new_assignee_ids:
            for assignee in User.objects.filter(id__in=new_assignee_ids):
                notify_ticket_assigned(
                    assignee=assignee,
                    ticket=ticket,
                    assigned_by=self.request.user,
                )

        changes = []
        if old.title != ticket.title:
            changes.append(f"title from '{old.title}' to '{ticket.title}'")
        if old.description != ticket.description:
            changes.append("description")
        if old.status != ticket.status:
            changes.append(f"status from '{old.status}' to '{ticket.status}'")
        if old.priority != ticket.priority:
            changes.append(f"priority from '{old.priority}' to '{ticket.priority}'")

        if old_ids != new_ids:
            old_names = ', '.join(u.username for u in old.assignees.all()) or 'Unassigned'
            new_names = ', '.join(u.username for u in ticket.assignees.all()) or 'Unassigned'
            changes.append(f"assignees from '{old_names}' to '{new_names}'")

        if changes:
            log_activity(
                action='update',
                user=self.request.user,
                instance=ticket,
                description=f"Updated ticket {ticket.ticket_id}: {', '.join(changes)}",
            )

    def perform_destroy(self, instance):
        log_activity(
            action='delete',
            user=self.request.user,
            description=f"Deleted ticket {instance.ticket_id}: {instance.title}",
        )
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        ticket = self.get_object()
        if ticket.created_by_id != request.user.id:
            return Response(
                {'error': "You can't delete this ticket. Only the creator can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    # ------------------------------------------------------------------
    # Status management
    # ------------------------------------------------------------------

    @action(detail=True, methods=['patch'])
    def update_status(self, request, id=None):
        ticket = self.get_object()
        serializer = TicketStatusSerializer(ticket, data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old_status = ticket.status
        new_status = serializer.validated_data['status']
        user       = request.user

        valid_transitions = self._get_valid_transitions(old_status)
        if new_status not in valid_transitions:
            return Response(
                {'error': (
                    f"Cannot transition from '{old_status}' to '{new_status}'. "
                    f"Valid transitions: {valid_transitions}"
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'in_progress' and not ticket.assignees.exists():
            return Response(
                {'error': 'Cannot move to In Progress without an assignee. Please assign the ticket first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._handle_work_log_on_status_change(ticket, old_status, new_status, user)
        serializer.save()

        log_activity(
            action='status_change',
            user=user,
            instance=ticket,
            description=f"Changed ticket {ticket.ticket_id} status from '{old_status}' to '{new_status}'",
            extra_data={'old_status': old_status, 'new_status': new_status},
        )

        return Response(TicketSerializer(ticket).data)

    def _get_valid_transitions(self, current_status: str) -> list:
        """Define valid status transitions — linear workflow."""
        transitions = {
            'new':        ['in_progress'],
            'in_progress': ['qa', 'reopened'],
            'qa':         ['closed', 'in_progress', 'reopened'],
            'closed':     ['reopened'],
            'reopened':   ['in_progress'],
        }
        return transitions.get(current_status, [])

    def _handle_work_log_on_status_change(self, ticket, old_status, new_status, user):
        """Automatically manage work logs based on status changes."""

        if new_status == 'closed':
            active_log = WorkLog.objects.filter(ticket=ticket, end_time__isnull=True).first()
            if active_log:
                active_log.end_time = timezone.now()
                active_log.save()
                log_activity(
                    action='work_log',
                    user=active_log.user,
                    instance=ticket,
                    description=f"Work session ended (ticket closed) - {active_log.duration_minutes} minutes logged",
                )

        elif new_status == 'in_progress' and old_status in ['new', 'reopened']:
            already_active = WorkLog.objects.filter(ticket=ticket, end_time__isnull=True).exists()
            if not already_active:
                WorkLog.objects.create(ticket=ticket, user=user, start_time=timezone.now())
                log_activity(
                    action='work_log',
                    user=user,
                    instance=ticket,
                    description="Work session started",
                )

        elif new_status == 'reopened' and old_status == 'closed':
            ticket.assignees.clear()
            ticket.save()
            log_activity(
                action='status_change',
                user=user,
                instance=ticket,
                description="Ticket reopened - assignees cleared, ready for new assignment",
            )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get ticket counts by status, respecting other filters."""
        queryset = self._queryset_without_status_filter()
        result = {key: 0 for key in TICKET_STATUS_KEYS}

        for row in queryset.values('status').annotate(count=Count('pk')):
            status_key = row['status']
            if status_key in result:
                result[status_key] = row['count']

        # Derive total from the breakdown so "All" always matches the tabs.
        result['total'] = sum(result[key] for key in TICKET_STATUS_KEYS)
        return Response(result)

    # ------------------------------------------------------------------
    # Assignment actions
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def my_tickets(self, request):
        """Get tickets assigned to the current user."""
        tickets    = Ticket.objects.filter(assignees=request.user)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_project(self, request):
        """Get tickets filtered by project."""
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tickets    = self.get_queryset().filter(project_id=project_id)
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
        ticket         = self.get_object()
        user           = request.user
        target_user_id = request.data.get('user_id')

        if not target_user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user_id = int(target_user_id)
        except (ValueError, TypeError):
            return Response({'error': 'user_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        is_manager_or_admin = user.role in ['admin', 'manager']
        is_creator          = ticket.created_by_id == user.id
        is_project_member   = ticket.project.members.filter(id=user.id).exists()

        if not is_manager_or_admin and not is_creator and not is_project_member:
            return Response(
                {'error': 'Only project members, managers, admins, or ticket creators can assign tickets.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_is_member = (
            ticket.project.members.filter(id=target_user.id).exists()
            or target_user.role in ['admin', 'manager']
        )
        if not target_is_member:
            return Response(
                {'error': 'Only project members can be assigned to tickets.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ticket.assignees.filter(id=target_user.id).exists():
            return Response(TicketSerializer(ticket).data)

        ticket.assignees.add(target_user)

        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Assigned ticket {ticket.ticket_id} to {target_user.username}",
        )

        notify_ticket_assigned(
            assignee=target_user,
            ticket=ticket,
            assigned_by=user,
        )

        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def unassign(self, request, id=None):
        """Remove a user from ticket assignees. Pass user_id in body, or omit to remove self."""
        ticket         = self.get_object()
        user           = request.user
        target_user_id = request.data.get('user_id')

        if target_user_id is not None:
            try:
                target_user_id = int(target_user_id)
            except (ValueError, TypeError):
                return Response({'error': 'user_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            target_user = user  # remove self

        is_manager_or_admin = user.role in ['admin', 'manager']
        is_creator          = ticket.created_by_id == user.id

        if target_user.id != user.id and not is_manager_or_admin and not is_creator:
            return Response(
                {'error': 'Only managers or ticket creators can remove other assignees.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ticket.assignees.remove(target_user)

        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Removed {target_user.username} from ticket {ticket.ticket_id}",
        )

        return Response(TicketSerializer(ticket).data)

    @action(detail=True, methods=['post'])
    def self_assign(self, request, id=None):
        """Allow a project member to add themselves to a ticket's assignees."""
        ticket    = self.get_object()
        user      = request.user
        is_member = (
            ticket.project.members.filter(id=user.id).exists()
            or user.role in ['admin', 'manager']
        )
        if not is_member:
            return Response(
                {'error': 'Only project members can self-assign tickets.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ticket.assignees.add(user)

        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Self-assigned ticket {ticket.ticket_id}",
        )

        return Response(TicketSerializer(ticket).data)

    # ------------------------------------------------------------------
    # Media actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='media')
    def upload_media(self, request, id=None):
        """Upload a media file to a ticket — any project member can upload."""
        ticket    = self.get_object()
        user      = request.user
        is_member = (
            ticket.project.members.filter(id=user.id).exists()
            or user.role in ['admin', 'manager']
        )
        if not is_member:
            return Response(
                {'error': 'You must be a member of this project to upload files.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_file(file)
        except ValidationError as e:
            return Response({'error': str(e.detail[0]) if isinstance(e.detail, list) else str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)

        media = TicketMedia.objects.create(
            ticket=ticket,
            file=file,
            file_name=file.name,
            file_type=get_file_type(file.name),
            file_size=file.size,
            uploaded_by=user,
        )

        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Uploaded attachment: {file.name}",
        )

        return Response(
            TicketMediaSerializer(media, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'], url_path=r'media/(?P<media_id>\d+)')
    def delete_media(self, request, id=None, media_id=None):
        """Delete a media file from a ticket — only creator, manager, or admin can delete."""
        ticket     = self.get_object()
        user       = request.user
        can_delete = user.role in ['admin', 'manager'] or ticket.created_by_id == user.id

        if not can_delete:
            return Response(
                {'error': 'Only managers, admins, or ticket creators can delete attachments.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            media = TicketMedia.objects.get(id=media_id, ticket=ticket)
        except TicketMedia.DoesNotExist:
            return Response({'error': 'Media not found'}, status=status.HTTP_404_NOT_FOUND)

        file_name = media.file_name
        media.delete()

        log_activity(
            action='update',
            user=user,
            instance=ticket,
            description=f"Deleted attachment: {file_name}",
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Comments action
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, id=None):
        """Get or create comments for a ticket."""
        ticket = self.get_object()

        if request.method == 'GET':
            comments = (
                Comment.objects.filter(ticket=ticket)
                .prefetch_related('media_files')
                .order_by('created_at')
            )
            serializer = TicketCommentSerializer(
                comments,
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        content = (request.data.get('content') or '').strip()
        files = request.FILES.getlist('files')
        if not content and not files:
            return Response(
                {'error': 'Comment text or at least one image is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = Comment.objects.create(
            ticket=ticket,
            author=request.user,
            content=content,
        )

        for file in files:
            try:
                validate_image_file(file)
            except ValidationError as exc:
                comment.delete()
                return Response({'error': exc.detail[0]}, status=status.HTTP_400_BAD_REQUEST)

            TicketMedia.objects.create(
                ticket=ticket,
                comment=comment,
                file=file,
                file_name=file.name,
                file_size=file.size,
                file_type=get_file_type(file.name),
                uploaded_by=request.user,
            )

        log_activity(
            action='update',
            user=request.user,
            instance=ticket,
            description="Added a comment",
        )

        if content:
            notify_comment_mentions(request.user, ticket, content)

        comment = Comment.objects.prefetch_related('media_files').get(pk=comment.pk)
        return Response(
            TicketCommentSerializer(comment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )
