from django.contrib import admin
from .models import OfficeSettings, LeaveRequest, Attendance, AttendanceLog


@admin.register(OfficeSettings)
class OfficeSettingsAdmin(admin.ModelAdmin):
    list_display = ['office_start_time', 'office_end_time', 'auto_mark_absent', 'updated_at']
    readonly_fields = ['updated_at']
    
    def has_add_permission(self, request):
        # Only allow one settings instance
        return not OfficeSettings.objects.exists()


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['employee', 'start_date', 'end_date', 'status', 'created_at', 'approved_by']
    list_filter = ['status', 'created_at', 'start_date']
    search_fields = ['employee__username', 'employee__email', 'message']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at', 'approved_at']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'date', 'status', 'current_availability', 'first_available_at', 'is_available', 'formatted_summary']
    list_filter = ['status', 'date', 'current_availability']
    search_fields = ['employee__username', 'employee__email']
    date_hierarchy = 'date'
    readonly_fields = ['created_at', 'updated_at', 'formatted_summary']


@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ['employee', 'date', 'status', 'timestamp', 'time_display', 'is_auto']
    list_filter = ['status', 'date', 'is_auto']
    search_fields = ['employee__username', 'note']
    date_hierarchy = 'date'
    readonly_fields = ['timestamp']
