from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum
from .models import WorkLog
from .serializers import WorkLogSerializer, WorkLogCreateSerializer, WorkLogUpdateSerializer
from apps.activity.utils import log_activity


class WorkLogViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return WorkLogCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return WorkLogUpdateSerializer
        return WorkLogSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = WorkLog.objects.all()
        
        # Filter by ticket if provided
        ticket_id = self.request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        
        # Filter by user if provided
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Non-admin and non-manager users can only see their own work logs
        if user.role not in ['admin', 'manager']:
            queryset = queryset.filter(user=user)
        
        return queryset.select_related('user', 'ticket')
    
    def perform_create(self, serializer):
        work_log = serializer.save(user=self.request.user, start_time=timezone.now())
        # Log activity
        log_activity(
            action='work_log',
            user=self.request.user,
            instance=work_log.ticket,
            description=f"Started work on ticket {work_log.ticket.ticket_id}",
            extra_data={'work_log_id': work_log.id, 'start_time': work_log.start_time.isoformat()}
        )
    
    @action(detail=False, methods=['post'])
    def start_work(self, request):
        """Start tracking work on a ticket"""
        ticket_id = request.data.get('ticket_id')
        notes = request.data.get('notes', '')
        
        if not ticket_id:
            return Response(
                {'error': 'ticket_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already has an active work log
        active_log = WorkLog.objects.filter(
            user=request.user,
            end_time__isnull=True
        ).first()
        
        if active_log:
            return Response(
                {
                    'error': 'You already have an active work session',
                    'active_work_log': WorkLogSerializer(active_log).data
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new work log
        work_log = WorkLog.objects.create(
            user=request.user,
            ticket_id=ticket_id,
            start_time=timezone.now(),
            notes=notes
        )
        
        # Log activity
        log_activity(
            action='work_log',
            user=request.user,
            instance=work_log.ticket,
            description=f"Started work on ticket {work_log.ticket.ticket_id}",
            extra_data={'work_log_id': work_log.id, 'start_time': work_log.start_time.isoformat()}
        )
        
        return Response(
            WorkLogSerializer(work_log).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def stop_work(self, request, pk=None):
        """Stop tracking work and calculate duration"""
        work_log = self.get_object()
        
        if work_log.end_time:
            return Response(
                {'error': 'This work log has already been stopped'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if work_log.user != request.user:
            return Response(
                {'error': 'You can only stop your own work sessions'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        work_log.end_time = timezone.now()
        work_log.save()  # This will calculate duration automatically
        
        # Log activity
        log_activity(
            action='work_log',
            user=request.user,
            instance=work_log.ticket,
            description=f"Stopped work on ticket {work_log.ticket.ticket_id} ({work_log.duration_minutes} minutes)",
            extra_data={
                'work_log_id': work_log.id, 
                'end_time': work_log.end_time.isoformat(),
                'duration_minutes': work_log.duration_minutes
            }
        )
        
        return Response(WorkLogSerializer(work_log).data)
    
    @action(detail=False, methods=['get'])
    def active_session(self, request):
        """Get the current active work session for the user"""
        active_log = WorkLog.objects.filter(
            user=request.user,
            end_time__isnull=True
        ).first()
        
        if not active_log:
            return Response({'active': False})
        
        return Response({
            'active': True,
            'work_log': WorkLogSerializer(active_log).data,
            'elapsed_minutes': int((timezone.now() - active_log.start_time).total_seconds() / 60)
        })
    
    @action(detail=False, methods=['get'])
    def ticket_active_session(self, request):
        """Get the active work session for a specific ticket (for stopwatch display)"""
        ticket_id = request.query_params.get('ticket_id')
        
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        
        # Get active work log for this ticket
        active_log = WorkLog.objects.filter(
            ticket_id=ticket_id,
            end_time__isnull=True
        ).first()
        
        # Check if user can view this - admin/manager or the assignee
        from apps.tickets.models import Ticket
        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'active': False, 'error': 'Ticket not found'})
        
        can_view = user.role in ['admin', 'manager'] or ticket.assignee_id == user.id
        
        if not can_view:
            return Response({'active': False, 'error': 'Permission denied'})
        
        if not active_log:
            return Response({'active': False})
        
        # Calculate elapsed time
        elapsed_seconds = int((timezone.now() - active_log.start_time).total_seconds())
        
        return Response({
            'active': True,
            'work_log': WorkLogSerializer(active_log).data,
            'elapsed_seconds': elapsed_seconds,
            'elapsed_formatted': self._format_duration(elapsed_seconds),
            'user_id': active_log.user_id,
            'user_name': active_log.user.username
        })
    
    def _format_duration(self, seconds):
        """Format seconds to HH:MM:SS"""
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    
    @action(detail=False, methods=['get'])
    def total_time(self, request):
        """Get total time spent on a ticket"""
        ticket_id = request.query_params.get('ticket_id')
        
        if not ticket_id:
            return Response(
                {'error': 'ticket_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        queryset = self.get_queryset().filter(ticket_id=ticket_id, end_time__isnull=False)
        
        # Calculate total duration
        total = queryset.aggregate(total_minutes=Sum('duration_minutes'))
        
        return Response({
            'ticket_id': ticket_id,
            'total_minutes': total['total_minutes'] or 0,
            'total_hours': round((total['total_minutes'] or 0) / 60, 2),
            'work_log_count': queryset.count()
        })
    
    @action(detail=False, methods=['get'])
    def my_logs(self, request):
        """Get all work logs for the current user"""
        logs = WorkLog.objects.filter(user=request.user).order_by('-start_time')
        serializer = WorkLogSerializer(logs, many=True)
        return Response(serializer.data)
