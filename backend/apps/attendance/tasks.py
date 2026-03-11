from datetime import timedelta
from .models import Attendance, LeaveRequest


def mark_attendance_for_leave(leave_request):
    """
    Mark attendance as 'leave' for working days only in the leave request.
    Skips Saturdays and holidays - does not create attendance records for non-working days.
    Called when a leave request is approved.
    """
    current_date = leave_request.start_date
    
    while current_date <= leave_request.end_date:
        # Only mark leave for working days (exclude Saturday and holidays)
        if Attendance.is_working_day(current_date):
            attendance, created = Attendance.objects.get_or_create(
                employee=leave_request.employee,
                date=current_date,
                defaults={'status': 'neutral'}
            )
            attendance.mark_leave(leave_request)
        
        current_date += timedelta(days=1)
