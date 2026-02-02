from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import ActivityLog
from .serializers import ActivityLogSerializer


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for activity logs"""
    permission_classes = [IsAuthenticated]
    serializer_class = ActivityLogSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = ActivityLog.objects.all()
        
        # Filter by ticket if provided
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(
                content_type__model='ticket',
                object_id=ticket_id
            )
        
        # Filter by user if provided
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by action type
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Users can only see activities on tickets they have access to
        if user.role == 'admin':
            return queryset.select_related('user', 'content_type')
        
        if user.role == 'manager':
            # Managers see activities for tickets in their projects
            return queryset.filter(
                Q(content_type__model='ticket',
                  object_id__in=user.project_memberships.values_list('tickets__id', flat=True)) |
                Q(content_type__model='comment',
                  object_id__in=user.comments.values_list('ticket_id', flat=True))
            ).distinct().select_related('user', 'content_type')
        
        # Employee: only their own activities and activities on their tickets
        return queryset.filter(
            Q(user=user) |
            Q(content_type__model='ticket',
              object_id__in=user.assigned_tickets.values_list('id', flat=True))
        ).distinct().select_related('user', 'content_type')
    
    @action(detail=False, methods=['get'])
    def by_ticket(self, request):
        """Get activity logs filtered by ticket"""
        ticket_id = request.query_params.get('ticket_id')
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logs = self.get_queryset().filter(
            content_type__model='ticket',
            object_id=ticket_id
        )
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent activity logs for the user"""
        limit = int(request.query_params.get('limit', 10))
        logs = self.get_queryset()[:limit]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
