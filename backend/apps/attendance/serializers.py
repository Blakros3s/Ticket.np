from django.utils import timezone
from rest_framework import serializers
from .models import OfficeSettings, LeaveRequest, Attendance, AttendanceLog
from apps.users.serializers import UserSerializer


class OfficeSettingsSerializer(serializers.ModelSerializer):
    """Serializer for office settings"""
    is_within_office_hours = serializers.ReadOnlyField()
    has_office_hours_ended = serializers.ReadOnlyField()
    
    class Meta:
        model = OfficeSettings
        fields = [
            'id', 'office_start_time', 'office_end_time', 
            'auto_mark_absent', 'is_within_office_hours', 
            'has_office_hours_ended', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Serializer for leave requests"""
    employee = UserSerializer(read_only=True)
    approved_by = UserSerializer(read_only=True)
    duration_days = serializers.ReadOnlyField(source='get_duration_days')
    
    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'start_date', 'end_date', 'message',
            'status', 'approved_by', 'approved_at', 'rejection_reason',
            'duration_days', 'created_at', 'updated_at'
        ]
        read_only_fields = ['status', 'approved_by', 'approved_at', 'rejection_reason', 'created_at', 'updated_at']


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating leave requests"""
    
    class Meta:
        model = LeaveRequest
        fields = ['start_date', 'end_date', 'message']
    
    def validate(self, data):
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("End date must be after start date")
        
        return data


class AttendanceLogSerializer(serializers.ModelSerializer):
    """Serializer for attendance log entries"""
    time_display = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = AttendanceLog
        fields = ['id', 'status', 'status_display', 'timestamp', 'time_display', 'is_auto', 'note']


class AttendanceSerializer(serializers.ModelSerializer):
    """Serializer for attendance records"""
    employee = UserSerializer(read_only=True)
    is_available = serializers.ReadOnlyField()
    visibility_status = serializers.ReadOnlyField()
    daily_logs = AttendanceLogSerializer(many=True, read_only=True)
    formatted_summary = serializers.ReadOnlyField()
    first_available_time = serializers.SerializerMethodField()
    can_toggle_status = serializers.SerializerMethodField()
    toggle_status_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'employee', 'date', 'status', 'current_availability',
            'first_available_at', 'last_changed_at', 'is_available',
            'visibility_status', 'daily_logs', 'formatted_summary',
            'first_available_time', 'can_toggle_status', 'toggle_status_message',
            'created_at'
        ]
    
    def get_first_available_time(self, obj):
        if obj.first_available_at:
            return timezone.localtime(obj.first_available_at).strftime('%I:%M:%S %p')
        return None
    
    def get_can_toggle_status(self, obj):
        can_toggle, _ = obj.can_toggle_status()
        return can_toggle
    
    def get_toggle_status_message(self, obj):
        _, message = obj.can_toggle_status()
        return message


class AttendanceToggleSerializer(serializers.Serializer):
    """Serializer for toggling availability status"""
    status = serializers.ChoiceField(choices=['available', 'unavailable'])
    date = serializers.DateField(required=False)
    
    def validate_date(self, value):
        from datetime import date
        if value and value > date.today():
            raise serializers.ValidationError("Cannot mark attendance for future dates")
        return value or date.today()


class TeamAttendanceSerializer(serializers.ModelSerializer):
    """Simplified serializer for team view"""
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    employee_username = serializers.CharField(source='employee.username', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    department_roles = serializers.SerializerMethodField()
    last_changed_time = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'employee_name', 'employee_username', 'employee_role',
            'department_roles', 'date', 'status', 'current_availability',
            'is_available', 'visibility_status', 'last_changed_time'
        ]
    
    def get_department_roles(self, obj):
        return [
            {'id': role.id, 'name': role.display_name, 'color': role.color}
            for role in obj.employee.department_roles.all()
        ]
    
    def get_last_changed_time(self, obj):
        if obj.last_changed_at:
            return timezone.localtime(obj.last_changed_at).strftime('%I:%M:%S %p')
        return None


class AttendanceDailyLogSerializer(serializers.ModelSerializer):
    """Serializer for daily attendance log (admin view)"""
    employee_name = serializers.CharField(source='employee.get_full_name', read_only=True)
    employee_username = serializers.CharField(source='employee.username', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    department_roles = serializers.SerializerMethodField()
    logs = serializers.SerializerMethodField()
    total_duration_available = serializers.SerializerMethodField()
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'employee_name', 'employee_username', 'employee_role',
            'department_roles', 'date', 'status', 'current_availability',
            'logs', 'total_duration_available', 'created_at'
        ]
    
    def get_department_roles(self, obj):
        return [
            {'id': role.id, 'name': role.display_name, 'color': role.color}
            for role in obj.employee.department_roles.all()
        ]
    
    def get_logs(self, obj):
        logs = obj.daily_logs
        return AttendanceLogSerializer(logs, many=True).data
    
    def get_total_duration_available(self, obj):
        """Calculate total time spent available"""
        from datetime import timedelta
        logs = obj.daily_logs.filter(status='available')
        if not logs.exists():
            return None
        
        total_seconds = 0
        for log in logs:
            # Simple calculation: from available to next unavailable or now
            total_seconds += 3600  # Placeholder - would need complex interval calculation
        
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours}h {minutes}m"
