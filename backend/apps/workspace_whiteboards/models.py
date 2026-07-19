import uuid

from django.db import models

from apps.projects.models import Project
from apps.users.models import User


class Whiteboard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    canvas_data = models.JSONField(default=dict, blank=True)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='whiteboards',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='whiteboards_created',
    )
    last_edited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='whiteboards_edited',
        null=True,
        blank=True,
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workspace_whiteboards'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['project', 'is_archived']),
            models.Index(fields=['created_by', 'is_archived']),
        ]

    def __str__(self) -> str:
        return self.title


class WhiteboardVersion(models.Model):
    whiteboard = models.ForeignKey(Whiteboard, on_delete=models.CASCADE, related_name='versions')
    canvas_data = models.JSONField()
    edited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whiteboard_versions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_whiteboard_versions'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.whiteboard.title} @ {self.created_at}'


class WhiteboardShareLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    whiteboard = models.ForeignKey(
        Whiteboard,
        on_delete=models.CASCADE,
        related_name='share_links',
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whiteboard_share_links')
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspace_whiteboard_share_links'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'share:{self.id} → {self.whiteboard.title}'
