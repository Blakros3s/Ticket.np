from django.contrib import admin
from .models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'category', 'is_full_day', 'created_by', 'created_at']
    list_filter = ['category', 'date', 'is_full_day']
    search_fields = ['title', 'description']
    date_hierarchy = 'date'
    ordering = ['-date']
