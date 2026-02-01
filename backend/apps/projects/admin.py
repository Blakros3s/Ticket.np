from django.contrib import admin
from .models import Project, ProjectMember


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'description', 'created_by__username']
    ordering = ['-created_at']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ['project', 'user', 'joined_at']
    list_filter = ['joined_at']
    search_fields = ['project__name', 'user__username']
    ordering = ['-joined_at']
