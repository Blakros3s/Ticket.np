from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Comment
from .serializers import CommentSerializer, CommentCreateSerializer


class CommentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CommentCreateSerializer
        return CommentSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Comment.objects.all()
        
        # Filter by ticket if provided
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        
        # Users can only see comments on tickets they have access to
        if user.role == 'admin':
            return queryset.select_related('author', 'ticket')
        
        if user.role == 'manager':
            return queryset.filter(
                Q(ticket__project__created_by=user) | 
                Q(ticket__project__members=user) |
                Q(ticket__assignee=user) |
                Q(ticket__created_by=user)
            ).distinct().select_related('author', 'ticket')
        
        # Employee: only comments on their assigned tickets or tickets in their projects
        return queryset.filter(
            Q(ticket__assignee=user) |
            Q(ticket__project__members=user) |
            Q(ticket__created_by=user)
        ).distinct().select_related('author', 'ticket')
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    def perform_update(self, serializer):
        # Only allow updating own comments
        comment = self.get_object()
        if comment.author != self.request.user:
            raise PermissionError("You can only edit your own comments")
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only allow deleting own comments or admin/manager
        user = self.request.user
        if instance.author != user and user.role not in ['admin', 'manager']:
            raise PermissionError("You can only delete your own comments")
        instance.delete()
    
    @action(detail=False, methods=['get'])
    def by_ticket(self, request):
        """Get comments filtered by ticket"""
        ticket_id = request.query_params.get('ticket_id')
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comments = self.get_queryset().filter(ticket_id=ticket_id)
        serializer = self.get_serializer(comments, many=True)
        return Response(serializer.data)
