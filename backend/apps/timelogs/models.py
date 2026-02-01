from django.db import models
from apps.users.models import User
from apps.tickets.models import Ticket


class WorkLog(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='work_logs')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='work_logs')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0, help_text='Duration in minutes')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'work_logs'
        verbose_name = 'Work Log'
        verbose_name_plural = 'Work Logs'
        ordering = ['-start_time']
    
    def __str__(self):
        return f"{self.user.username} - {self.ticket.ticket_id} - {self.duration_minutes}min"
    
    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            duration = self.end_time - self.start_time
            self.duration_minutes = int(duration.total_seconds() / 60)
        super().save(*args, **kwargs)
