import re

from django.db import models, transaction
from apps.users.models import User
from apps.projects.models import Project


TICKET_ID_PREFIX = 'TKT-'
TICKET_ID_PAD_WIDTH = 4
TICKET_ID_PATTERN = re.compile(
    rf'^{TICKET_ID_PREFIX}(?P<code>[A-Z0-9]+)-(?P<sequence>\d+)$',
    re.IGNORECASE,
)


def format_ticket_id(project_code: str, number: int) -> str:
    """Format a project-scoped ticket ID, e.g. TKT-RMS-0001."""
    normalized_code = re.sub(r'[^A-Za-z0-9]', '', (project_code or '').upper())
    return f'{TICKET_ID_PREFIX}{normalized_code}-{str(number).zfill(TICKET_ID_PAD_WIDTH)}'


def format_ticket_number(number: int, project_code: str = 'PRJ') -> str:
    """Backward-compatible helper for callers that still pass only a sequence number."""
    return format_ticket_id(project_code, number)


def parse_ticket_sequence(ticket_id: str | None, project_code: str | None = None) -> int | None:
    """Extract the numeric sequence from ticket_id (supports project-scoped and legacy formats)."""
    if not ticket_id:
        return None

    value = ticket_id.strip()
    match = TICKET_ID_PATTERN.match(value)
    if match:
        if project_code and match.group('code').upper() != project_code.upper():
            return None
        return int(match.group('sequence'))

    legacy_prefix = TICKET_ID_PREFIX
    if value.upper().startswith(legacy_prefix):
        suffix = value[len(legacy_prefix):]
        if suffix.isdigit():
            return int(suffix)

    if value.isdigit():
        return int(value)

    return None


def allocate_next_ticket_id(project: Project) -> str:
    """Return the next sequential ticket_id for a project (thread-safe per project)."""
    project_code = project.ticket_code
    with transaction.atomic():
        counter, _ = TicketIdCounter.objects.select_for_update().get_or_create(
            project=project,
            defaults={'last_number': 0},
        )
        counter.last_number += 1
        counter.save(update_fields=['last_number'])
        return format_ticket_id(project_code, counter.last_number)


from apps.core.media_paths import tenant_scoped_upload_path


def ticket_media_upload_path(instance, filename):
    return tenant_scoped_upload_path(f'ticket_media/{instance.ticket.id}/{filename}')


class TicketIdCounter(models.Model):
    """Tracks the last issued ticket number for each project within a tenant schema."""

    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name='ticket_id_counter',
        primary_key=True,
    )
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ticket_id_counter'

    def __str__(self) -> str:
        return f'Ticket counter for {self.project.ticket_code} (last={self.last_number})'


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
    
    ticket_id = models.CharField(max_length=32, unique=True, editable=False)
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
            project = self.project
            if project.pk is None:
                project.save()
            elif not getattr(project, 'ticket_code', None):
                project.refresh_from_db(fields=['ticket_code'])
            self.ticket_id = allocate_next_ticket_id(project)
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
