from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.access import user_can_access_project
from apps.customers.services.doc_sharing import create_public_share, revoke_public_share
from apps.workspace_docs.models import DocShareLink, WorkspaceDoc, WorkspaceDocStar
from apps.workspace_docs.permissions import CanCreateShareLink, WorkspaceDocPermission
from apps.workspace_docs.serializers import (
    DocShareCreateSerializer,
    DocShareLinkSerializer,
    WorkspaceDocCreateSerializer,
    WorkspaceDocListSerializer,
    WorkspaceDocSerializer,
)


class WorkspaceDocViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, WorkspaceDocPermission]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        qs = WorkspaceDoc.objects.select_related(
            'project', 'created_by', 'last_edited_by',
        ).filter(is_archived=False)

        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        workspace_only = self.request.query_params.get('workspace_only')
        if workspace_only in ('1', 'true', 'True'):
            qs = qs.filter(project__isnull=True)

        starred = self.request.query_params.get('starred')
        if starred in ('1', 'true', 'True'):
            qs = qs.filter(stars__user=user)

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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            user = self.request.user
            context['starred_doc_ids'] = set(
                WorkspaceDocStar.objects.filter(user=user).values_list('doc_id', flat=True),
            )
        return context

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkspaceDocListSerializer
        if self.action == 'create':
            return WorkspaceDocCreateSerializer
        return WorkspaceDocSerializer

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        user = self.request.user
        if project and not user_can_access_project(user, project):
            raise PermissionDenied('You are not a member of this project.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()
        if request.user.role != 'admin' and doc.created_by_id != request.user.id:
            raise PermissionDenied('Only the creator or an admin can delete this document.')
        doc.is_archived = True
        doc.save(update_fields=['is_archived', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def star(self, request, id=None):
        doc = self.get_object()
        WorkspaceDocStar.objects.get_or_create(user=request.user, doc=doc)
        return Response({'is_starred': True})

    @action(detail=True, methods=['post'])
    def unstar(self, request, id=None):
        doc = self.get_object()
        WorkspaceDocStar.objects.filter(user=request.user, doc=doc).delete()
        return Response({'is_starred': False})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanCreateShareLink])
    def share(self, request, id=None):
        doc = self.get_object()
        serializer = DocShareCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expires_at = serializer.validated_data.get('expires_at')
        if expires_at is None:
            expires_at = timezone.now() + timedelta(days=30)
        link = create_public_share(
            doc=doc,
            created_by=request.user,
            tenant_schema=request.tenant.schema_name,
            expires_at=expires_at,
        )
        return Response(
            DocShareLinkSerializer(link, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def share_links(self, request, id=None):
        doc = self.get_object()
        if request.user.role not in ('admin', 'manager') and doc.created_by_id != request.user.id:
            raise PermissionDenied('You cannot view share links for this document.')
        links = doc.share_links.filter(is_active=True).order_by('-created_at')
        return Response(DocShareLinkSerializer(links, many=True, context={'request': request}).data)


class DocShareLinkViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def destroy(self, request, pk=None):
        try:
            link = DocShareLink.objects.select_related('doc').get(pk=pk)
        except DocShareLink.DoesNotExist as exc:
            raise NotFound('Share link not found.') from exc

        doc = link.doc
        if request.user.role != 'admin' and doc.created_by_id != request.user.id:
            raise PermissionDenied('Only the document creator or an admin can revoke share links.')

        revoke_public_share(link)
        return Response(status=status.HTTP_204_NO_CONTENT)
