import uuid

from django.db import models

from apps.projects.models import Project
from apps.users.models import User


class WorkspaceDoc(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    emoji = models.CharField(max_length=16, blank=True, default='')
    content = models.JSONField(default=dict)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='workspace_docs',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='workspace_docs_created',
    )
    last_edited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='workspace_docs_edited',
        null=True,
        blank=True,
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workspace_docs'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['project', 'is_archived']),
            models.Index(fields=['created_by', 'is_archived']),
        ]

    def __str__(self) -> str:
        return self.title


class DocVersion(models.Model):
    doc = models.ForeignKey(WorkspaceDoc, on_delete=models.CASCADE, related_name='versions')
    content = models.JSONField()
    edited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doc_versions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_doc_versions'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.doc.title} @ {self.created_at}'


class DocShareLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doc = models.ForeignKey(WorkspaceDoc, on_delete=models.CASCADE, related_name='share_links')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doc_share_links')
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_doc_share_links'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'share:{self.id} → {self.doc.title}'


class WorkspaceDocStar(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='starred_workspace_docs')
    doc = models.ForeignKey(WorkspaceDoc, on_delete=models.CASCADE, related_name='stars')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_doc_stars'
        constraints = [
            models.UniqueConstraint(fields=['user', 'doc'], name='workspace_doc_star_user_doc_unique'),
        ]

    def __str__(self) -> str:
        return f'{self.user_id} ★ {self.doc_id}'
