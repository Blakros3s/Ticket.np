from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.projects.models import Project


def generate_ticket_id():
    import random
    import string
    return f"TKT-{timezone.now().strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=4))}"


def ticket_media_upload_path(instance, filename):
    return f'ticket_media/{instance.ticket.id}/{filename}'


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
    
    in_progress_at = models.DateTimeField(null=True, blank=True)
    qa_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'tickets'
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.ticket_id} - {self.title}"


class TicketMedia(models.Model):
    MEDIA_TYPES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('document', 'Document'),
        ('other', 'Other'),
    ]
    
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='media_files')
    file = models.FileField(upload_to=ticket_media_upload_path)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=MEDIA_TYPES, default='other')
    file_size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_ticket_media')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'ticket_media'
        verbose_name = 'Ticket Media'
        verbose_name_plural = 'Ticket Media'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.file_name} - {self.ticket.ticket_id}"
