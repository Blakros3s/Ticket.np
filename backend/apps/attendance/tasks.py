from datetime import timedelta
from .models import Attendance, LeaveRequest


def mark_attendance_for_leave(leave_request):
    """
    Mark attendance as 'leave' for all days in the leave request.
    Called when a leave request is approved.
    """
    current_date = leave_request.start_date
    
    while current_date <= leave_request.end_date:
        attendance, created = Attendance.objects.get_or_create(
            employee=leave_request.employee,
            date=current_date,
            defaults={'status': 'neutral'}
        )
        
        attendance.mark_leave(leave_request)
        
        current_date += timedelta(days=1)
