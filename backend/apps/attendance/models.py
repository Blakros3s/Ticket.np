from django.db import models
from django.utils import timezone
from apps.users.models import User


class OfficeSettings(models.Model):
    """Global office settings - only one record should exist"""
    office_start_time = models.TimeField(default='10:00', help_text="Office start time (e.g., 10:00)")
    office_end_time = models.TimeField(default='17:00', help_text="Office end time (e.g., 17:00)")
    auto_mark_absent = models.BooleanField(default=True, help_text="Automatically mark absent after office hours end")
    
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='office_settings_updates'
    )
    
    class Meta:
        db_table = 'office_settings'
    
    def __str__(self):
        return f"Office Hours: {self.office_start_time} - {self.office_end_time}"
    
    @classmethod
    def get_settings(cls):
        """Get or create the singleton settings instance"""
        settings, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'office_start_time': '10:00',
                'office_end_time': '17:00',
                'auto_mark_absent': True
            }
        )
        return settings
    
    @property
    def is_within_office_hours(self):
        """Check if current time is within office hours"""
        now = timezone.localtime()
        current_time = now.time()
        return self.office_start_time <= current_time <= self.office_end_time
    
    @property
    def has_office_hours_ended(self):
        """Check if office hours have ended for today"""
        now = timezone.localtime()
        current_time = now.time()
        return current_time > self.office_end_time


class LeaveRequest(models.Model):
    """Leave requests from employees - simplified without leave types"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    start_date = models.DateField()
    end_date = models.DateField()
    message = models.TextField(help_text="Reason for leave")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Approval tracking
    approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='approved_leaves'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.employee.username} - {self.start_date} to {self.end_date}"
    
    def get_duration_days(self):
        """Calculate total leave days"""
        return (self.end_date - self.start_date).days + 1
    
    def is_approved_for_date(self, check_date):
        """Check if this leave covers a specific date"""
        return (
            self.status == 'approved' and
            self.start_date <= check_date <= self.end_date
        )
    
    def approve(self, approver):
        """Approve the leave request"""
        self.status = 'approved'
        self.approved_by = approver
        self.approved_at = timezone.now()
        self.save()
    
    def reject(self, approver, reason=''):
        """Reject the leave request"""
        self.status = 'rejected'
        self.approved_by = approver
        self.approved_at = timezone.now()
        self.rejection_reason = reason
        self.save()


class AttendanceLog(models.Model):
    """Detailed log of availability status changes throughout the day"""
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('unavailable', 'Unavailable'),
    ]
    
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_logs')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    timestamp = models.DateTimeField(default=timezone.now)
    
    # Track if this was automatically set (e.g., from leave approval)
    is_auto = models.BooleanField(default=False)
    note = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = 'attendance_logs'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.employee.username} - {self.date} - {self.status} at {self.timestamp.strftime('%H:%M:%S')}"
    
    @property
    def time_display(self):
        """Return formatted time"""
        return timezone.localtime(self.timestamp).strftime('%I:%M:%S %p')  # e.g., "10:00:05 AM"


class Attendance(models.Model):
    """Daily attendance summary for employees"""
    STATUS_CHOICES = [
        ('neutral', 'Neutral'),
        ('present', 'Present'),
        ('leave', 'Leave'),
        ('absent', 'Absent'),
    ]
    
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='neutral')
    
    # Current availability status (based on last log entry)
    current_availability = models.CharField(
        max_length=20, 
        choices=[('available', 'Available'), ('unavailable', 'Unavailable'), ('none', 'None')],
        default='none'
    )
    
    # If marked as leave, link to the leave request
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_records'
    )
    
    # First time they marked available
    first_available_at = models.DateTimeField(null=True, blank=True)
    
    # Last status change time
    last_changed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_records'
        unique_together = ['employee', 'date']
        ordering = ['-date', 'employee__username']
    
    def __str__(self):
        return f"{self.employee.username} - {self.date} - {self.get_status_display()}"
    
    def log_status_change(self, new_status, is_auto=False, note=''):
        """Log a status change and update current availability"""
        now = timezone.now()
        
        # Create log entry
        AttendanceLog.objects.create(
            employee=self.employee,
            date=self.date,
            status=new_status,
            timestamp=now,
            is_auto=is_auto,
            note=note
        )
        
        # Update current availability
        self.current_availability = new_status
        self.last_changed_at = now
        
        # Track first available time
        if new_status == 'available' and not self.first_available_at:
            self.first_available_at = now
        
        # If employee marked available at any point, they are present
        if new_status == 'available':
            self.status = 'present'
        
        # Ensure 'present' status is not downgraded if previously set
        if self.status != 'present' and new_status == 'available':
            self.status = 'present'
        
        self.save()

    @staticmethod
    def is_working_day(check_date):
        """Check if date is a working day (not Saturday, not a Holiday)"""
        # Saturday is index 5
        if check_date.weekday() == 5:
            return False
            
        # Check CalendarEvent for holidays
        from apps.calendar.models import CalendarEvent
        is_holiday = CalendarEvent.objects.filter(
            date=check_date,
            category='holiday'
        ).exists()
        
        return not is_holiday
    
    def mark_available(self):
        """Mark employee as available"""
        self.log_status_change('available', note='User marked available')
    
    def mark_unavailable(self):
        """Mark employee as unavailable"""
        self.log_status_change('unavailable', note='User marked unavailable')
    
    def mark_leave(self, leave_request):
        """Mark employee as on leave - automatically unavailable"""
        self.status = 'leave'
        self.leave_request = leave_request
        self.current_availability = 'unavailable'
        
        # Log as auto-unavailable
        self.log_status_change(
            'unavailable', 
            is_auto=True, 
            note=f'On approved leave ({leave_request.start_date} to {leave_request.end_date})'
        )
        self.save()
    
    def mark_absent(self):
        """Mark employee as absent (end of day with no logs)"""
        self.status = 'absent'
        self.current_availability = 'none'
        self.save()
    
    def can_toggle_status(self):
        """Check if employee can change their availability status"""
        settings = OfficeSettings.get_settings()
        
        # Check if office hours have ended
        if settings.has_office_hours_ended:
            return False, 'Office hours have ended'
        
        # Check if within office hours
        if not settings.is_within_office_hours:
            return False, 'Outside office hours'
        
        # Check if currently on leave
        if self.status == 'leave':
            return False, 'On approved leave'
        
        return True, None
    
    @property
    def is_available(self):
        """Check if employee is currently available"""
        return self.current_availability == 'available' and self.status == 'present'
    
    @property
    def visibility_status(self):
        """Get visibility status for team view"""
        if self.current_availability == 'available':
            return 'available'
        elif self.current_availability == 'unavailable' or self.status == 'leave':
            return 'unavailable'
        else:
            return 'hidden'
    
    @property
    def daily_logs(self):
        """Get all logs for this attendance record"""
        return AttendanceLog.objects.filter(employee=self.employee, date=self.date).order_by('timestamp')
    
    @property
    def formatted_summary(self):
        """Get formatted summary of the day's attendance"""
        logs = self.daily_logs
        if not logs.exists():
            return 'No activity'
        
        summary = []
        for log in logs:
            summary.append(f"{log.time_display}: {log.get_status_display()}")
        
        return ' | '.join(summary)
