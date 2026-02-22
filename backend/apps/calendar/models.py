from django.db import models
from django.core.exceptions import ValidationError
from apps.users.models import User


class CalendarEvent(models.Model):
    CATEGORY_CHOICES = [
        ('holiday', 'Holiday'),
        ('programme', 'Programme'),
        ('meeting', 'Meeting'),
        ('deadline', 'Deadline'),
        ('birthday', 'Birthday'),
        ('other', 'Other'),
    ]
    
    # Color mapping for categories
    CATEGORY_COLORS = {
        'holiday': '#ef4444',      # red-500
        'programme': '#3b82f6',    # blue-500
        'meeting': '#10b981',      # emerald-500
        'deadline': '#f59e0b',     # amber-500
        'birthday': '#8b5cf6',     # violet-500
        'other': '#6b7280',        # gray-500
    }
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    color = models.CharField(max_length=7, default='#6b7280', help_text="Hex color code")
    is_full_day = models.BooleanField(default=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    
    # Metadata
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'calendar_events'
        verbose_name = 'Calendar Event'
        verbose_name_plural = 'Calendar Events'
        ordering = ['date', 'start_time']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.date})"
    
    def save(self, *args, **kwargs):
        # Auto-assign color based on category if not set
        if not self.color or self.color == '#6b7280':
            self.color = self.CATEGORY_COLORS.get(self.category, '#6b7280')
        super().save(*args, **kwargs)
    
    def clean(self):
        if not self.is_full_day:
            if not self.start_time:
                raise ValidationError("Start time is required for non-full-day events.")
            if self.end_time and self.start_time > self.end_time:
                raise ValidationError("End time must be after start time.")
