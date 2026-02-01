from django.contrib import admin
from .models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_id', 'title', 'type', 'priority', 'status', 'project', 'assignee', 'created_at']
    list_filter = ['type', 'priority', 'status', 'created_at']
    search_fields = ['ticket_id', 'title', 'description', 'project__name', 'assignee__username']
    ordering = ['-created_at']
