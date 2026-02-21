from django.urls import path
from .views import (
    OfficeSettingsView,
    LeaveRequestListView, LeaveRequestDetailView,
    approve_leave_request, reject_leave_request,
    AttendanceListView, get_team_attendance, get_my_attendance,
    get_my_leave_requests, get_daily_attendance_logs, get_attendance_stats
)

urlpatterns = [
    # Office Settings
    path('settings/', OfficeSettingsView.as_view(), name='office-settings'),
    
    # Leave Requests
    path('leave-requests/', LeaveRequestListView.as_view(), name='leave-request-list'),
    path('leave-requests/my/', get_my_leave_requests, name='my-leave-requests'),
    path('leave-requests/<int:pk>/', LeaveRequestDetailView.as_view(), name='leave-request-detail'),
    path('leave-requests/<int:pk>/approve/', approve_leave_request, name='approve-leave'),
    path('leave-requests/<int:pk>/reject/', reject_leave_request, name='reject-leave'),
    
    # Attendance
    path('attendance/', AttendanceListView.as_view(), name='attendance-list'),
    path('attendance/team/', get_team_attendance, name='team-attendance'),
    path('attendance/me/', get_my_attendance, name='my-attendance'),
    path('attendance/logs/', get_daily_attendance_logs, name='daily-attendance-logs'),
    path('attendance/stats/', get_attendance_stats, name='attendance-stats'),
]
