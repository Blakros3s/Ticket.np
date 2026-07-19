from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
import logging

logger = logging.getLogger(__name__)

from apps.notifications.models import Notification
from apps.users.models import User
from apps.users.permissions import IsManagerOrAdmin
from apps.core.access import get_accessible_project
from apps.core.media_utils import build_protected_media_url
from .models import Project, ProjectMember, ProjectDocument
from .serializers import (
    ProjectSerializer,
    ProjectCreateSerializer,
    ProjectMemberSerializer,
    ProjectDocumentSerializer,
    ProjectSummarySerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ProjectCreateSerializer
        return ProjectSerializer
    
    def get_queryset(self):
        user = self.request.user
        base = Project.objects.select_related('created_by').prefetch_related(
            'projectmember_set__user__department_roles',
            'members',
        ).annotate(
            member_count=Count('members', distinct=True),
            ticket_count=Count('tickets', distinct=True),
            document_count=Count('documents', distinct=True),
        )

        if user.role == 'admin':
            return base

        return base.filter(
            Q(created_by=user) | Q(members=user),
        ).distinct()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = self.request.user
        if user.role == 'admin':
            queryset = Project.objects.all()
        else:
            queryset = Project.objects.filter(Q(created_by=user) | Q(members=user)).distinct()
        serializer = ProjectSummarySerializer(queryset.only('id', 'name').order_by('name'), many=True)
        return Response(serializer.data)
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'add_member', 'remove_member']:
            return [IsAuthenticated(), IsManagerOrAdmin()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if project.created_by_id != request.user.id:
            return Response(
                {'error': "You can't delete this project. Only the creator can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def add_member(self, request, pk=None):
        project = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if ProjectMember.objects.filter(project=project, user=user).exists():
            return Response(
                {'error': 'User is already a member of this project'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        member = ProjectMember.objects.create(project=project, user=user)
        if user.id != request.user.id:
            Notification.objects.create(
                user=user,
                message=f"You were added to project \"{project.name}\" by {request.user.get_full_name() or request.user.username}",
                project_id=project.id,
                project_name=project.name[:255],
            )
        serializer = ProjectMemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagerOrAdmin])
    def remove_member(self, request, pk=None):
        logger.info(f"Remove member request for project {pk} from user {request.user.username}")
        logger.info(f"Request data: {request.data}")
        project = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            logger.warning(f"remove_member failed: user_id is missing")
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            member = ProjectMember.objects.get(project=project, user_id=user_id)
        except ProjectMember.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this project'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Prevent removing the project creator
        if member.user_id == project.created_by_id:
            logger.warning(f"remove_member failed: cannot remove creator {member.user_id}")
            return Response(
                {'error': 'Cannot remove the project creator'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        member_id = member.user_id
        member.delete()
        logger.info(f"Successfully removed member {member_id} from project {pk}")
        return Response({'message': 'Member removed successfully'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def my_projects(self, request):
        user = request.user
        projects = Project.objects.filter(members=user)
        serializer = self.get_serializer(projects, many=True)
        return Response(serializer.data)


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_project(self):
        if not hasattr(self, '_project'):
            self._project = get_accessible_project(self.request.user, self.kwargs['project_pk'])
        return self._project
    
    def get_queryset(self):
        return ProjectDocument.objects.filter(project=self.get_project())
    
    def perform_create(self, serializer):
        serializer.save(project=self.get_project())
