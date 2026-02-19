from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django.utils import timezone

from .models import TodoItem
from .serializers import TodoItemSerializer, TodoItemCreateSerializer, TodoItemListSerializer


class IsOwner(permissions.BasePermission):
    """
    Only allow users to access their own todos.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


@extend_schema(tags=['Todos'])
class TodoItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsOwner]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['priority', 'status', 'is_completed']
    ordering_fields = ['created_at', 'due_date', 'priority', 'updated_at']
    ordering = ['-priority', 'due_date']
    
    def get_queryset(self):
        return TodoItem.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TodoItemCreateSerializer
        elif self.action == 'list':
            return TodoItemListSerializer
        return TodoItemSerializer
    
    @extend_schema(description="Get todos statistics for the current user")
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get todo statistics."""
        queryset = self.get_queryset()
        total = queryset.count()
        completed = queryset.filter(is_completed=True).count()
        pending = queryset.filter(is_completed=False).count()
        overdue = queryset.filter(
            is_completed=False,
            due_date__lt=timezone.now().date()
        ).count()
        
        by_priority = {
            priority[0]: queryset.filter(priority=priority[0]).count()
            for priority in TodoItem.PRIORITY_CHOICES
        }
        
        by_status = {
            status[0]: queryset.filter(status=status[0]).count()
            for status in TodoItem.STATUS_CHOICES
        }
        
        return Response({
            'total': total,
            'completed': completed,
            'pending': pending,
            'overdue': overdue,
            'completion_rate': round((completed / total * 100), 1) if total > 0 else 0,
            'by_priority': by_priority,
            'by_status': by_status,
        })
    
    @extend_schema(description="Get priority choices")
    @action(detail=False, methods=['get'])
    def priorities(self, request):
        """Get all available priority levels with colors."""
        priorities = [
            {
                'value': p[0],
                'label': p[1],
                'color': TodoItem.PRIORITY_COLORS.get(p[0], '#6b7280')
            }
            for p in TodoItem.PRIORITY_CHOICES
        ]
        return Response(priorities)
    
    @extend_schema(description="Get status choices")
    @action(detail=False, methods=['get'])
    def statuses(self, request):
        """Get all available statuses."""
        statuses = [
            {'value': s[0], 'label': s[1]}
            for s in TodoItem.STATUS_CHOICES
        ]
        return Response(statuses)
    
    @extend_schema(description="Mark todo as completed")
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a todo item as completed."""
        todo = self.get_object()
        todo.is_completed = True
        todo.status = 'completed'
        todo.save()
        serializer = self.get_serializer(todo)
        return Response(serializer.data)
    
    @extend_schema(description="Mark todo as pending (reopen)")
    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Reopen a completed todo item."""
        todo = self.get_object()
        todo.is_completed = False
        todo.status = 'pending'
        todo.completed_at = None
        todo.save()
        serializer = self.get_serializer(todo)
        return Response(serializer.data)
    
    @extend_schema(
        description="Bulk update todos",
        parameters=[
            OpenApiParameter(name='ids', type=list, location=OpenApiParameter.QUERY),
        ]
    )
    @action(detail=False, methods=['post'])
    def bulk_complete(self, request):
        """Mark multiple todos as completed."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=400)
        
        count = self.get_queryset().filter(id__in=ids).update(
            is_completed=True,
            status='completed'
        )
        return Response({'updated': count})
    
    @extend_schema(
        description="Bulk delete todos",
        parameters=[
            OpenApiParameter(name='ids', type=list, location=OpenApiParameter.QUERY),
        ]
    )
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Delete multiple todos."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided'}, status=400)
        
        count, _ = self.get_queryset().filter(id__in=ids).delete()
        return Response({'deleted': count})
