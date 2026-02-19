from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import datetime
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import CalendarEvent
from .serializers import CalendarEventSerializer, CalendarEventCreateSerializer, CalendarEventListSerializer
from apps.users.permissions import IsAdminUser


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Only admin users can create, update, or delete.
    All authenticated users can read.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == 'admin'
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


@extend_schema(tags=['Calendar'])
class CalendarEventViewSet(viewsets.ModelViewSet):
    queryset = CalendarEvent.objects.all()
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['category', 'date']
    ordering_fields = ['date', 'start_time', 'created_at']
    ordering = ['date', 'start_time']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CalendarEventCreateSerializer
        elif self.action == 'list':
            return CalendarEventListSerializer
        return CalendarEventSerializer
    
    @extend_schema(
        description="Get events for a specific month",
        parameters=[
            OpenApiParameter(name='year', type=int, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='month', type=int, location=OpenApiParameter.QUERY),
        ]
    )
    @action(detail=False, methods=['get'])
    def month(self, request):
        """Get all events for a specific month."""
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        if not year or not month:
            # Default to current month
            today = timezone.now()
            year = today.year
            month = today.month
        else:
            year = int(year)
            month = int(month)
        
        events = self.get_queryset().filter(
            date__year=year,
            date__month=month
        )
        
        serializer = CalendarEventListSerializer(events, many=True)
        return Response({
            'year': year,
            'month': month,
            'events': serializer.data
        })
    
    @extend_schema(
        description="Get events for a specific date range",
        parameters=[
            OpenApiParameter(name='start', type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='end', type=str, location=OpenApiParameter.QUERY),
        ]
    )
    @action(detail=False, methods=['get'])
    def range(self, request):
        """Get events for a specific date range."""
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'Both start and end dates are required.'},
                status=400
            )
        
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                status=400
            )
        
        events = self.get_queryset().filter(date__range=[start, end])
        serializer = CalendarEventListSerializer(events, many=True)
        return Response({
            'start': start_date,
            'end': end_date,
            'count': events.count(),
            'events': serializer.data
        })
    
    @extend_schema(description="Get all category choices")
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all available event categories with their colors."""
        categories = [
            {'value': cat[0], 'label': cat[1], 'color': CalendarEvent.CATEGORY_COLORS.get(cat[0], '#6b7280')}
            for cat in CalendarEvent.CATEGORY_CHOICES
        ]
        return Response(categories)
