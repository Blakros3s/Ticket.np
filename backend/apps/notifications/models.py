from django.db import models
from django.utils import timezone
from apps.users.models import User


class Notification(models.Model):
    """Notification for ticket assignment or project membership. Auto-deleted after 7 days."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=500)
    ticket_id = models.PositiveIntegerField(null=True, blank=True)
    ticket_title = models.CharField(max_length=255, blank=True)
    project_id = models.PositiveIntegerField(null=True, blank=True)
    project_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.message[:50]}"
