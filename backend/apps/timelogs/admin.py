from django.contrib import admin
from .models import WorkLog


@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'user', 'start_time', 'end_time', 'duration_minutes', 'created_at']
    list_filter = ['created_at', 'start_time']
    search_fields = ['ticket__ticket_id', 'user__username', 'notes']
    ordering = ['-start_time']
