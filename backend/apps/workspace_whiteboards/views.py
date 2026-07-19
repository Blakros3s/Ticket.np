from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.access import user_can_access_project, user_can_create_ticket_on_project
from apps.customers.services.wb_sharing import create_public_whiteboard_share, revoke_public_whiteboard_share
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer
from apps.workspace_docs.permissions import CanCreateShareLink
from apps.workspace_whiteboards.canvas_utils import (
    attach_ticket_to_shape,
    find_note_shape,
    note_text_from_shape,
)
from apps.workspace_whiteboards.models import Whiteboard, WhiteboardShareLink
from apps.workspace_whiteboards.permissions import WhiteboardPermission
from apps.workspace_whiteboards.serializers import (
    ConvertElementSerializer,
    WhiteboardCreateSerializer,
    WhiteboardListSerializer,
    WhiteboardSerializer,
    WhiteboardShareCreateSerializer,
    WhiteboardShareLinkSerializer,
)


class WhiteboardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, WhiteboardPermission]
    lookup_field = 'id'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        whiteboard = serializer.instance
        output = WhiteboardSerializer(whiteboard, context=self.get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_queryset(self):
        user = self.request.user
        qs = Whiteboard.objects.select_related(
            'project', 'created_by', 'last_edited_by',
        ).filter(is_archived=False)

        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        workspace_only = self.request.query_params.get('workspace_only')
        if workspace_only in ('1', 'true', 'True'):
            qs = qs.filter(project__isnull=True)

        query = self.request.query_params.get('q', '').strip()
        if query:
            qs = qs.filter(title__icontains=query)

        if user.role == 'admin':
            return qs.distinct()

        if user.role == 'manager':
            return qs.filter(
                models.Q(project__isnull=True, created_by=user)
                | models.Q(project__created_by=user)
                | models.Q(project__members=user)
                | models.Q(created_by=user)
            ).distinct()

        return qs.filter(
            models.Q(project__isnull=True, created_by=user)
            | models.Q(project__members=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return WhiteboardListSerializer
        if self.action == 'create':
            return WhiteboardCreateSerializer
        return WhiteboardSerializer

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        user = self.request.user
        if project and not user_can_access_project(user, project):
            raise PermissionDenied('You are not a member of this project.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        board_id = kwargs.get('id')
        try:
            whiteboard = Whiteboard.objects.get(pk=board_id)
        except Whiteboard.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        if whiteboard.is_archived:
            return Response(status=status.HTTP_204_NO_CONTENT)

        if request.user.role != 'admin' and whiteboard.created_by_id != request.user.id:
            raise PermissionDenied('Only the creator or an admin can delete this whiteboard.')
        whiteboard.is_archived = True
        whiteboard.save(update_fields=['is_archived', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='convert-element')
    def convert_element(self, request, id=None):
        whiteboard = self.get_object()
        serializer = ConvertElementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        element_id = serializer.validated_data['element_id']

        if not whiteboard.project_id:
            raise ValidationError({
                'detail': 'Link this whiteboard to a project before converting notes to tickets.',
            })

        shape = find_note_shape(whiteboard.canvas_data or {}, element_id)
        if shape is None:
            raise ValidationError({'element_id': 'Sticky note not found on this whiteboard.'})

        existing_ticket_id = (shape.get('meta') or {}).get('ticketId')
        if existing_ticket_id:
            raise ValidationError({'detail': 'This sticky note is already linked to a ticket.'})

        title = serializer.validated_data.get('title') or note_text_from_shape(shape) or 'Untitled'
        project = whiteboard.project
        user = request.user
        if not user_can_create_ticket_on_project(user, project):
            raise PermissionDenied('You must be a project member to create tickets on this project.')

        ticket = Ticket.objects.create(
            title=title,
            description=f'Created from whiteboard "{whiteboard.title}".',
            type='task',
            priority='medium',
            project=project,
            created_by=user,
        )

        updated_canvas = attach_ticket_to_shape(
            whiteboard.canvas_data or {},
            element_id,
            ticket_id=ticket.id,
            ticket_ticket_id=ticket.ticket_id,
        )
        whiteboard.canvas_data = updated_canvas
        whiteboard.last_edited_by = user
        whiteboard.save(update_fields=['canvas_data', 'last_edited_by', 'updated_at'])

        from apps.workspace_whiteboards.models import WhiteboardVersion
        WhiteboardVersion.objects.create(
            whiteboard=whiteboard,
            canvas_data=whiteboard.canvas_data,
            edited_by=user,
        )

        return Response({
            'ticket': TicketSerializer(ticket, context=self.get_serializer_context()).data,
            'canvas_data': whiteboard.canvas_data,
            'updated_at': whiteboard.updated_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanCreateShareLink])
    def share(self, request, id=None):
        whiteboard = self.get_object()
        serializer = WhiteboardShareCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expires_at = serializer.validated_data.get('expires_at')
        if expires_at is None:
            expires_at = timezone.now() + timedelta(days=30)
        link = create_public_whiteboard_share(
            whiteboard=whiteboard,
            created_by=request.user,
            tenant_schema=request.tenant.schema_name,
            expires_at=expires_at,
        )
        return Response(
            WhiteboardShareLinkSerializer(link, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def share_links(self, request, id=None):
        whiteboard = self.get_object()
        if request.user.role not in ('admin', 'manager') and whiteboard.created_by_id != request.user.id:
            raise PermissionDenied('You cannot view share links for this whiteboard.')
        links = whiteboard.share_links.filter(is_active=True).order_by('-created_at')
        return Response(WhiteboardShareLinkSerializer(links, many=True, context={'request': request}).data)


class WhiteboardShareLinkViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def destroy(self, request, pk=None):
        try:
            link = WhiteboardShareLink.objects.select_related('whiteboard').get(pk=pk)
        except WhiteboardShareLink.DoesNotExist as exc:
            raise NotFound('Share link not found.') from exc

        whiteboard = link.whiteboard
        if request.user.role != 'admin' and whiteboard.created_by_id != request.user.id:
            raise PermissionDenied('Only the whiteboard creator or an admin can revoke share links.')

        revoke_public_whiteboard_share(link)
        return Response(status=status.HTTP_204_NO_CONTENT)
