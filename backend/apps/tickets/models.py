from django.db import models, transaction
from apps.users.models import User
from apps.projects.models import Project


TICKET_ID_PREFIX = 'TKT-'
TICKET_ID_PAD_WIDTH = 4


def format_ticket_number(number: int) -> str:
    """Format a ticket sequence number as TKT-0001, TKT-0002, …"""
    return f'{TICKET_ID_PREFIX}{str(number).zfill(TICKET_ID_PAD_WIDTH)}'


def parse_ticket_sequence(ticket_id: str | None) -> int | None:
    """Extract the numeric sequence from ticket_id (supports TKT-0001 and legacy 0001)."""
    if not ticket_id:
        return None

    value = ticket_id.strip()
    prefix = TICKET_ID_PREFIX
    if value.upper().startswith(prefix):
        suffix = value[len(prefix):]
        if suffix.isdigit():
            return int(suffix)

    if value.isdigit():
        return int(value)

    return None


def allocate_next_ticket_id() -> str:
    """Return the next sequential ticket_id for this tenant schema (thread-safe)."""
    with transaction.atomic():
        counter, _ = TicketIdCounter.objects.select_for_update().get_or_create(
            pk=1,
            defaults={'last_number': 0},
        )
        counter.last_number += 1
        counter.save(update_fields=['last_number'])
        return format_ticket_number(counter.last_number)


from apps.core.media_paths import tenant_scoped_upload_path


def ticket_media_upload_path(instance, filename):
    return tenant_scoped_upload_path(f'ticket_media/{instance.ticket.id}/{filename}')


class TicketIdCounter(models.Model):
    """Singleton row tracking the last issued ticket number per tenant schema."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ticket_id_counter'
        constraints = [
            models.CheckConstraint(check=models.Q(id=1), name='ticket_id_counter_singleton'),
        ]

    def __str__(self) -> str:
        return f'Ticket counter (last={self.last_number})'


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
    
    ticket_id = models.CharField(max_length=20, unique=True, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='task')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tickets')
    assignees = models.ManyToManyField(User, related_name='assigned_tickets', blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    in_progress_at = models.DateTimeField(null=True, blank=True)
    qa_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    module = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        default=None,
        help_text='Optional project area (e.g. notifications, settings)',
    )
    
    class Meta:
        db_table = 'tickets'
        verbose_name = 'Ticket'
        verbose_name_plural = 'Tickets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['due_date']),
            models.Index(fields=['project', 'status']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.ticket_id:
            self.ticket_id = allocate_next_ticket_id()
        super().save(*args, **kwargs)
    
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
    comment = models.ForeignKey(
        'comments.Comment',
        on_delete=models.CASCADE,
        related_name='media_files',
        null=True,
        blank=True,
    )
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
