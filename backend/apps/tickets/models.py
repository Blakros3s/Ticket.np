from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.projects.models import Project


def generate_ticket_id():
    import random
    import string
    return f"TKT-{timezone.now().strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=4))}"


class Ticket(models.Model):
    TYPE_CHOICES = [
        ('bug', 'Bug'),
        ('task', 'Task'),
        ('feature', 'Feature'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    STATUS_CHOICES = [
        ('new', 'New'),
        ('in_progress', 'In Progress'),
        ('qa', 'QA'),
        ('closed', 'Closed'),
        ('reopened', 'Reopened'),
    ]
    
    ticket_id = models.CharField(max_length=20, unique=True, default=generate_ticket_id)
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='task')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tickets')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tickets'
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.ticket_id} - {self.title}"
