import re

from django.db import models
from apps.users.models import User

TICKET_CODE_MAX_LENGTH = 10


def derive_ticket_code_from_name(name: str) -> str:
    """Build a project code from the first character of each word (e.g. RMS)."""
    words = re.findall(r'[A-Za-z0-9]+', (name or '').strip())
    if not words:
        return 'PRJ'
    code = ''.join(word[0].upper() for word in words)
    return code[:TICKET_CODE_MAX_LENGTH]


def normalize_ticket_code(value: str) -> str:
    """Normalize user input to an uppercase alphanumeric ticket code."""
    return re.sub(r'[^A-Za-z0-9]', '', (value or '').upper())[:TICKET_CODE_MAX_LENGTH]


def allocate_unique_ticket_code(name: str, exclude_pk: int | None = None) -> str:
    """Return a unique ticket code for the tenant, appending a suffix on collision."""
    base = derive_ticket_code_from_name(name) or 'PRJ'
    candidate = base
    suffix = 2

    queryset = Project.objects.all()
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)

    while queryset.filter(ticket_code__iexact=candidate).exists():
        suffix_text = str(suffix)
        trimmed_base = base[: max(1, TICKET_CODE_MAX_LENGTH - len(suffix_text))]
        candidate = f'{trimmed_base}{suffix_text}'
        suffix += 1

    return candidate


class Project(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archived'),
    ]
    
    name = models.CharField(max_length=255)
    ticket_code = models.CharField(
        max_length=TICKET_CODE_MAX_LENGTH,
        unique=True,
        help_text='Short code used in ticket IDs, e.g. RMS for Restaurant Management System.',
    )
    description = models.TextField(blank=True)
    github_repo = models.URLField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_projects')
    members = models.ManyToManyField(User, through='ProjectMember', related_name='projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'projects'
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if self.ticket_code:
            self.ticket_code = normalize_ticket_code(self.ticket_code)
        else:
            self.ticket_code = allocate_unique_ticket_code(self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    @property
    def ticket_id_example(self) -> str:
        from apps.tickets.models import format_ticket_id

        return format_ticket_id(self.ticket_code, 1)
    
    def __str__(self):
        return self.name


class ProjectMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_members'
        unique_together = ['project', 'user']
        verbose_name = 'Project Member'
        verbose_name_plural = 'Project Members'
    
    def __str__(self):
        return f"{self.user.username} - {self.project.name}"


from apps.core.media_paths import tenant_scoped_upload_path


def upload_to(instance, filename):
    return tenant_scoped_upload_path(f'project_documents/{instance.project.id}/{filename}')


class ProjectDocument(models.Model):
    DOCUMENT_TYPES = [
        ('pdf', 'PDF'),
        ('doc', 'Word Document'),
        ('docx', 'Word Document'),
        ('md', 'Markdown'),
        ('txt', 'Text File'),
        ('image', 'Image'),
        ('other', 'Other'),
    ]
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=upload_to)
    file_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES, default='other')
    file_size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_documents')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_documents'
        verbose_name = 'Project Document'
        verbose_name_plural = 'Project Documents'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
