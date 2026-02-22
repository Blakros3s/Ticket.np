from django.contrib import admin
from .models import TodoItem


@admin.register(TodoItem)
class TodoItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'priority', 'status', 'is_completed', 'due_date', 'created_at']
    list_filter = ['priority', 'status', 'is_completed']
    search_fields = ['title', 'description', 'user__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
