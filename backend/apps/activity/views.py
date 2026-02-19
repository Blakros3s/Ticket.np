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
        action_type = self.request.query_params.get('action')
        if action_type:
            queryset = queryset.filter(action=action_type)
        
        # Admin and Manager see all activities
        if user.role in ['admin', 'manager']:
            return queryset.select_related('user', 'content_type')
        
        # Regular users only see their own activities
        return queryset.filter(user=user).select_related('user', 'content_type')
    
    @action(detail=False, methods=['get'])
    def by_ticket(self, request):
        """Get activity logs filtered by ticket - respects user role"""
        ticket_id = request.query_params.get('ticket_id')
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        
        # Base query for the ticket
        logs = ActivityLog.objects.filter(
            content_type__model='ticket',
            object_id=ticket_id
        )
        
        # Admin and Manager see all activities for the ticket
        if user.role in ['admin', 'manager']:
            pass  # No additional filtering
        else:
            # Regular users only see their own activities on this ticket
            logs = logs.filter(user=user)
        
        logs = logs.select_related('user', 'content_type')
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent activity logs for the user"""
        limit = int(request.query_params.get('limit', 10))
        logs = self.get_queryset()[:limit]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
