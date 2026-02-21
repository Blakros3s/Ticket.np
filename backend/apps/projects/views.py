from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import logging

logger = logging.getLogger(__name__)
from django.db import models # Moved this import to the top as it's used in ProjectViewSet
from .models import Project, ProjectMember, ProjectDocument
from .serializers import ProjectSerializer, ProjectCreateSerializer, ProjectMemberSerializer, ProjectDocumentSerializer
from apps.users.permissions import IsManagerOrAdmin
from apps.users.models import User


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ProjectCreateSerializer
        return ProjectSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin sees all projects
        if user.role == 'admin':
            return Project.objects.all()
        
        # Manager sees projects they created and are members of
        if user.role == 'manager':
            return Project.objects.filter(
                models.Q(created_by=user) | models.Q(members=user)
            ).distinct()
        
        # Employee sees only projects they are members of
        return Project.objects.filter(members=user)
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'add_member', 'remove_member']:
            return [IsAuthenticated(), IsManagerOrAdmin()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
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
    
    def get_queryset(self):
        return ProjectDocument.objects.filter(project_id=self.kwargs['project_pk'])
    
    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)
