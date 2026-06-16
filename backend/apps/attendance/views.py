import logging
from datetime import date, timedelta, datetime
from django.utils import timezone
from rest_framework import generics, permissions, status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from .models import OfficeSettings, LeaveRequest, Attendance, AttendanceLog
from .serializers import (
    OfficeSettingsSerializer,
    LeaveRequestSerializer, LeaveRequestCreateSerializer,
    AttendanceSerializer, AttendanceToggleSerializer, TeamAttendanceSerializer,
    AttendanceDailyLogSerializer
)
from apps.users.permissions import IsAdminUser, IsManagerOrAdmin

logger = logging.getLogger(__name__)


# ==================== OFFICE SETTINGS VIEWS ====================

@extend_schema_view(
    get=extend_schema(summary="Get office settings", description="Get current office hours settings"),
    put=extend_schema(summary="Update office settings", description="Update office hours (Admin only)")
)
class OfficeSettingsView(generics.RetrieveUpdateAPIView):
    """Get or update office settings"""
    serializer_class = OfficeSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return OfficeSettings.get_settings()
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]
    
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


# ==================== LEAVE REQUEST VIEWS ====================

@extend_schema_view(
    get=extend_schema(summary="List leave requests", description="Get leave requests for current user or all (Admin/Manager)"),
    post=extend_schema(summary="Create leave request", description="Submit a new leave request")
)
class LeaveRequestListView(generics.ListCreateAPIView):
    """List and create leave requests"""
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(employee=user)
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return LeaveRequestCreateSerializer
        return LeaveRequestSerializer
    
    def perform_create(self, serializer):
        """Create leave request - attendance is NOT marked until approved"""
        serializer.save(employee=self.request.user)


@extend_schema_view(
    get=extend_schema(summary="Get leave request details"),
    patch=extend_schema(summary="Update leave request"),
    delete=extend_schema(summary="Cancel leave request")
)
class LeaveRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or cancel a leave request"""
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(employee=user)
    
    def perform_destroy(self, instance):
        """Delete leave request"""
        from rest_framework.exceptions import ValidationError
        if instance.status != 'pending':
            raise ValidationError("You can only delete pending leave requests.")
        instance.delete()
        
    def perform_update(self, serializer):
        """Update leave request"""
        from rest_framework.exceptions import ValidationError
        if serializer.instance.status != 'pending':
            raise ValidationError("You can only edit pending leave requests.")
        serializer.save()


@extend_schema_view(
    post=extend_schema(
        summary="Approve leave request",
        description="Approve a pending leave request (Admin/Manager only). Attendance will be marked as 'leave' for the duration."
    )
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsManagerOrAdmin])
def approve_leave_request(request, pk):
    """Approve a leave request and mark attendance as leave"""
    try:
        leave_request = LeaveRequest.objects.get(pk=pk)
    except LeaveRequest.DoesNotExist:
        return Response({'detail': 'Leave request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if leave_request.status != 'pending':
        return Response({'detail': 'Can only approve pending requests'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Approve the leave request
    leave_request.approve(request.user)
    
    # Mark attendance as leave for the duration
    from .tasks import mark_attendance_for_leave
    mark_attendance_for_leave(leave_request)
    
    return Response({'message': 'Leave request approved'}, status=status.HTTP_200_OK)


@extend_schema_view(
    post=extend_schema(
        summary="Reject leave request",
        description="Reject a pending leave request (Admin/Manager only)"
    )
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsManagerOrAdmin])
def reject_leave_request(request, pk):
    """Reject a leave request"""
    try:
        leave_request = LeaveRequest.objects.get(pk=pk)
    except LeaveRequest.DoesNotExist:
        return Response({'detail': 'Leave request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if leave_request.status != 'pending':
        return Response({'detail': 'Can only reject pending requests'}, status=status.HTTP_400_BAD_REQUEST)
    
    reason = request.data.get('reason', '')
    leave_request.reject(request.user, reason)
    
    return Response({'message': 'Leave request rejected'}, status=status.HTTP_200_OK)


# ==================== ATTENDANCE VIEWS ====================

@extend_schema_view(
    get=extend_schema(summary="Get attendance records", description="Get attendance for a date range"),
    post=extend_schema(summary="Toggle availability", description="Toggle between available/unavailable during office hours")
)
class AttendanceListView(generics.ListCreateAPIView):
    """List and toggle attendance records"""
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None
    
    def get_queryset(self):
        user = self.request.user
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        # History view should generally be for the logged-in user only
        # Admins/Managers can filter by employee_id if they want others' history
        queryset = Attendance.objects.filter(employee=user)
        
        if user.role in ['admin', 'manager'] and self.request.query_params.get('employee_id'):
            queryset = Attendance.objects.filter(employee_id=self.request.query_params.get('employee_id'))
        
        # Date filtering
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Filter working days in memory if needed, but better to do it via model method in serializer or aggregate
        # For simple list view, we just return the records that exist
        return queryset.select_related('employee').order_by('-date')
    
    def create(self, request, *args, **kwargs):
        """Toggle availability status - only during office hours"""
        serializer = AttendanceToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        today = timezone.localdate()
        target_date = serializer.validated_data.get('date', today)
        new_status = serializer.validated_data.get('status')
        
        # Block toggle on non-working days (Saturday, holidays)
        if not Attendance.is_working_day(target_date):
            return Response(
                {'detail': 'Cannot mark attendance on non-working days (weekend or public holiday).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create attendance record
        attendance, created = Attendance.objects.get_or_create(
            employee=request.user,
            date=target_date,
            defaults={'status': 'neutral', 'current_availability': 'none'}
        )
        
        # Check if can toggle status
        can_toggle, message = attendance.can_toggle_status()
        if not can_toggle:
            return Response(
                {'detail': message},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log the status change
        if new_status == 'available':
            attendance.mark_available()
        else:
            attendance.mark_unavailable()
        
        response_serializer = AttendanceSerializer(attendance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(summary="Get team attendance", description="Get today's attendance for all team members")
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_team_attendance(request):
    """Get today's team availability board for all authenticated users."""
    today = timezone.localdate()
    
    # Skip attendance logic on non-working days (Saturday, holidays)
    if not Attendance.is_working_day(today):
        return Response({
            'is_working_day': False,
            'message': 'Today is a non-working day (weekend or public holiday).',
            'records': []
        })
    
    settings = OfficeSettings.get_settings()
    
    # Get all employees
    from apps.users.models import User
    employees = User.objects.filter(is_active=True).exclude(role='admin')
    
    # Get or create attendance records for today
    attendance_records = []
    for employee in employees:
        attendance, created = Attendance.objects.get_or_create(
            employee=employee,
            date=today,
            defaults={'status': 'neutral', 'current_availability': 'none'}
        )
        
        # Auto-mark absent if still neutral and end of day
        if attendance.status == 'neutral':
            # Check for approved leave
            has_approved_leave = LeaveRequest.objects.filter(
                employee=employee,
                status='approved',
                start_date__lte=today,
                end_date__gte=today
            ).exists()
            
            if has_approved_leave:
                leave_req = LeaveRequest.objects.filter(
                    employee=employee,
                    status='approved',
                    start_date__lte=today,
                    end_date__gte=today
                ).first()
                attendance.mark_leave(leave_req)
            elif settings.has_office_hours_ended and settings.auto_mark_absent:
                # Past office hours, mark as absent (no logs = absent)
                attendance.mark_absent()
        
        attendance_records.append(attendance)
    
    # Show all employees (available, unavailable, or hidden/neutral)
    visible_records = attendance_records
    
    serializer = TeamAttendanceSerializer(visible_records, many=True)
    return Response(serializer.data)


@extend_schema_view(
    get=extend_schema(summary="Get my attendance status", description="Get current user's attendance for today")
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_attendance(request):
    """Get current user's attendance for today"""
    today = timezone.localdate()
    
    # On non-working days (Saturday, holidays), return a special response
    if not Attendance.is_working_day(today):
        return Response({
            'date': today.isoformat(),
            'is_working_day': False,
            'message': 'Today is a non-working day (weekend or public holiday).',
            'status': 'neutral',
            'current_availability': 'none',
            'can_toggle_status': False,
            'daily_logs': []
        })
    
    settings = OfficeSettings.get_settings()
    
    attendance, created = Attendance.objects.get_or_create(
        employee=request.user,
        date=today,
        defaults={'status': 'neutral', 'current_availability': 'none'}
    )
    
    # Check if user has approved leave for today
    if attendance.status == 'neutral':
        has_approved_leave = LeaveRequest.objects.filter(
            employee=request.user,
            status='approved',
            start_date__lte=today,
            end_date__gte=today
        ).exists()
        
        if has_approved_leave:
            leave_req = LeaveRequest.objects.filter(
                employee=request.user,
                status='approved',
                start_date__lte=today,
                end_date__gte=today
            ).first()
            attendance.mark_leave(leave_req)
    
    # Auto-mark absent if office hours ended and still neutral (no logs)
    if attendance.status == 'neutral' and settings.has_office_hours_ended and settings.auto_mark_absent:
        attendance.mark_absent()
    
    serializer = AttendanceSerializer(attendance)
    return Response(serializer.data)


@extend_schema_view(
    get=extend_schema(summary="Get my leave requests", description="Get all leave requests for current user")
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_leave_requests(request):
    """Get all leave requests for the current user"""
    leave_requests = LeaveRequest.objects.filter(employee=request.user).order_by('-created_at')
    serializer = LeaveRequestSerializer(leave_requests, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsManagerOrAdmin])
def get_daily_attendance_logs(request):
    """Get detailed attendance logs for all employees for a specific date"""
    # Get date parameter (default to today)
    date_str = request.query_params.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        target_date = timezone.localdate()
    
    # Check if it's a working day
    if not Attendance.is_working_day(target_date):
        return Response({
            'summary': {
                'date': target_date.isoformat(),
                'is_working_day': False,
                'message': 'This is a non-working day (weekend or public holiday).'
            },
            'records': []
        })

    # Get all active employees (excluding admins)
    from apps.users.models import User
    employees = User.objects.filter(is_active=True).exclude(role='admin')
    
    settings = OfficeSettings.get_settings()
    attendance_records = []
    for employee in employees:
        attendance, created = Attendance.objects.get_or_create(
            employee=employee,
            date=target_date,
            defaults={'status': 'neutral', 'current_availability': 'none'}
        )
        # Apply auto-marking logic if neutral
        if attendance.status == 'neutral':
            has_approved_leave = LeaveRequest.objects.filter(
                employee=employee,
                status='approved',
                start_date__lte=target_date,
                end_date__gte=target_date
            ).exists()
            
            if has_approved_leave:
                leave_req = LeaveRequest.objects.filter(
                    employee=employee,
                    status='approved',
                    start_date__lte=target_date,
                    end_date__gte=target_date
                ).first()
                attendance.mark_leave(leave_req)
            elif settings.has_office_hours_ended and settings.auto_mark_absent:
                attendance.mark_absent()
        
        attendance_records.append(attendance)

    serializer = AttendanceDailyLogSerializer(attendance_records, many=True)
    
    data = serializer.data
    summary = {
        'date': target_date.isoformat(),
        'is_working_day': True,
        'total_employees': len(attendance_records),
        'present_count': sum(1 for r in data if r['status'] == 'present'),
        'absent_count': sum(1 for r in data if r['status'] == 'absent'),
        'leave_count': sum(1 for r in data if r['status'] == 'leave'),
        'neutral_count': sum(1 for r in data if r['status'] == 'neutral'),
        'available_now': sum(1 for r in data if r['current_availability'] == 'available'),
    }
    
    return Response({
        'summary': summary,
        'records': data
    })


@extend_schema(
    summary="Get attendance statistics",
    description="Get aggregated attendance statistics for a date range"
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_attendance_stats(request):
    """Get aggregated statistics for attendance"""
    user = request.user
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')
    
    if not start_date_str or not end_date_str:
        end_date = timezone.localdate()
        start_date = end_date.replace(day=1)
    else:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        if start_date > end_date:
            return Response({'detail': 'Start date must be before end date'}, status=status.HTTP_400_BAD_REQUEST)

    if user.role in ['admin', 'manager'] and request.query_params.get('all_employees') == 'true':
        from apps.users.models import User as AppUser
        employees = AppUser.objects.filter(is_active=True).exclude(role='admin')
        stats = []
        for emp in employees:
            emp_stats = Attendance.aggregate_stats_for_employee(emp, start_date, end_date)
            stats.append({
                'employee_id': emp.id,
                'username': emp.username,
                'full_name': emp.get_full_name(),
                'present_days': emp_stats['present_days'],
                'absent_days': emp_stats['absent_days'],
                'leave_days': emp_stats['leave_days'],
                'working_days': emp_stats['total_working_days'],
                'percentage': emp_stats['percentage'],
            })
        total_working_days = Attendance.count_working_days_in_range(start_date, end_date)
        return Response({
            'range': {'start': start_date, 'end': end_date},
            'total_working_days': total_working_days,
            'stats': stats
        })

    target_user = user
    if user.role in ['admin', 'manager'] and request.query_params.get('employee_id'):
        from apps.users.models import User as AppUser
        target_user = AppUser.objects.get(id=request.query_params.get('employee_id'))

    stats = Attendance.aggregate_stats_for_employee(target_user, start_date, end_date)
    return Response({
        'username': target_user.username,
        'range': {'start': start_date, 'end': end_date},
        **stats,
    })


@extend_schema(
    summary="Get monthly attendance calendar",
    description="Get day-by-day attendance calendar for a month"
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_attendance_calendar(request):
    """Return attendance status for each day in a calendar month or date range."""
    import calendar as cal_module

    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')
    year_str = request.query_params.get('year')
    month_str = request.query_params.get('month')

    if start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)
        if start_date > end_date:
            return Response({'detail': 'Start date must be before end date'}, status=status.HTTP_400_BAD_REQUEST)
        year = start_date.year
        month = start_date.month
    else:
        try:
            year = int(year_str) if year_str else timezone.localdate().year
            month = int(month_str) if month_str else timezone.localdate().month
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid year or month'}, status=status.HTTP_400_BAD_REQUEST)

        if month < 1 or month > 12:
            return Response({'detail': 'Month must be between 1 and 12'}, status=status.HTTP_400_BAD_REQUEST)

        last_day = cal_module.monthrange(year, month)[1]
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

    target_user = request.user
    if request.user.role in ['admin', 'manager'] and request.query_params.get('employee_id'):
        from apps.users.models import User as AppUser
        target_user = AppUser.objects.get(id=request.query_params.get('employee_id'))

    days = Attendance.build_calendar_days(target_user, start_date, end_date)
    return Response({
        'year': year,
        'month': month,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'days': days,
    })
