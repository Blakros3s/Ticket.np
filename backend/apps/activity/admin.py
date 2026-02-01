from django.contrib import admin
from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'description_preview', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['user__username', 'description']
    ordering = ['-created_at']
    readonly_fields = ['action', 'user', 'content_type', 'object_id', 'description', 'extra_data', 'created_at']
    
    def description_preview(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    description_preview.short_description = 'Description'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
