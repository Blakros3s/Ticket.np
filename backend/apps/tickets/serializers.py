from rest_framework import serializers
from rest_framework.exceptions import ValidationError
import re
from django.utils.html import strip_tags
from apps.core.media_utils import build_protected_media_url
from .models import Ticket, TicketMedia
from apps.comments.models import Comment
from apps.users.models import User
from apps.projects.models import Project

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_IMAGE_EXTS = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg')
_VIDEO_EXTS = ('.mp4', '.webm', '.mov', '.avi', '.mkv')
_DOC_EXTS   = ('.pdf', '.doc', '.docx', '.txt', '.md', '.xls', '.xlsx', '.ppt', '.pptx')

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
_FILE_EXTS = _IMAGE_EXTS + _VIDEO_EXTS + _DOC_EXTS

_BR_TAG_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
_BLOCK_END_TAG_RE = re.compile(
    r'</(p|div|li|h[1-6]|tr|blockquote|pre)>',
    re.IGNORECASE,
)


def sanitize_multiline_text(value: str) -> str:
    """Strip HTML while preserving paragraph and line breaks from pasted content."""
    if not value:
        return value

    text = value.replace('\r\n', '\n').replace('\r', '\n')
    text = _BR_TAG_RE.sub('\n', text)
    text = _BLOCK_END_TAG_RE.sub('\n', text)
    return strip_tags(text)


def validate_file(file):
    if file.size > MAX_FILE_SIZE:
        raise ValidationError(f"File size exceeds 10 MB limit ({file.size / 1024 / 1024:.1f} MB).")
    name = file.name.lower()
    if not name.endswith(_FILE_EXTS):
        raise ValidationError(f"File type '{name.rsplit('.', 1)[-1]}' is not supported.")


def get_file_type(filename: str) -> str:
    """Return a canonical media-type label for the given filename."""
    name = filename.lower()
    if name.endswith(_IMAGE_EXTS):
        return 'image'
    if name.endswith(_VIDEO_EXTS):
        return 'video'
    if name.endswith(_DOC_EXTS):
        return 'document'
    return 'other'


def _build_assignee_dict(user) -> dict:
    """Return a consistent assignee representation dict for a User instance."""
    first = user.first_name or ''
    last  = user.last_name or ''
    return {
        'id':           user.id,
        'username':     user.username,
        'first_name':   first,
        'last_name':    last,
        'display_name': f"{first} {last}".strip() or user.username,
    }


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class TicketCommentSerializer(serializers.ModelSerializer):
    user_name     = serializers.StringRelatedField(source='author', read_only=True)
    user_username = serializers.SerializerMethodField()

    class Meta:
        model  = Comment
        fields = ['id', 'author', 'user_name', 'user_username', 'content', 'created_at', 'updated_at']
        read_only_fields = ['author', 'created_at', 'updated_at']

    def get_user_username(self, obj):
        return obj.author.username


class TicketMediaSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.StringRelatedField(source='uploaded_by', read_only=True)

    class Meta:
        model  = TicketMedia
        fields = [
            'id', 'file', 'file_name', 'file_type', 'file_size',
            'uploaded_by', 'uploaded_by_username', 'created_at',
        ]
        read_only_fields = ['file_type', 'file_size', 'uploaded_by', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and instance.file:
            data['file'] = build_protected_media_url(request, instance.file.name)
        return data

    def create(self, validated_data):
        file = validated_data['file']
        validated_data['file_name']  = file.name
        validated_data['file_size']  = file.size
        validated_data['file_type']  = get_file_type(file.name)
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)


class TicketSerializer(serializers.ModelSerializer):
    created_by   = serializers.StringRelatedField(read_only=True)
    assignees    = serializers.SerializerMethodField()
    assignees_list = serializers.SerializerMethodField()
    project_name = serializers.StringRelatedField(source='project', read_only=True)
    media_files  = TicketMediaSerializer(many=True, read_only=True)
    comments     = TicketCommentSerializer(many=True, read_only=True)

    class Meta:
        model  = Ticket
        fields = [
            'id', 'ticket_id', 'title', 'description', 'type', 'priority', 'status',
            'project', 'project_name', 'assignees', 'assignees_list', 'created_by',
            'created_at', 'updated_at', 'media_files', 'comments',
            'in_progress_at', 'qa_at', 'closed_at',
        ]
        read_only_fields = [
            'ticket_id', 'created_by', 'created_at', 'updated_at',
            'in_progress_at', 'qa_at', 'closed_at',
        ]

    def get_assignees(self, obj):
        """Return list of assignee IDs for API compatibility."""
        return list(obj.assignees.values_list('id', flat=True))

    def get_assignees_list(self, obj):
        """Return full assignee objects for display."""
        return [_build_assignee_dict(u) for u in obj.assignees.all()]


class TicketCreateSerializer(serializers.ModelSerializer):
    media_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )
    assignees = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model  = Ticket
        fields = ['title', 'description', 'type', 'priority', 'project', 'assignees', 'media_files']

    def validate_title(self, value):
        return strip_tags(value)

    def validate_description(self, value):
        return sanitize_multiline_text(value)

    def create(self, validated_data):
        media_files  = validated_data.pop('media_files', [])
        assignee_ids = validated_data.pop('assignees', [])
        validated_data['created_by'] = self.context['request'].user
        ticket = super().create(validated_data)

        if assignee_ids:
            ticket.assignees.set(assignee_ids)

        for file in media_files:
            validate_file(file)
            TicketMedia.objects.create(
                ticket=ticket,
                file=file,
                file_name=file.name,
                file_size=file.size,
                uploaded_by=validated_data['created_by'],
                file_type=get_file_type(file.name),
            )

        return ticket


class TicketUpdateSerializer(serializers.ModelSerializer):
    assignees = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model  = Ticket
        fields = ['title', 'description', 'type', 'priority', 'assignees']

    def validate_title(self, value):
        return strip_tags(value)

    def validate_description(self, value):
        return sanitize_multiline_text(value)

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignees', None)
        instance = super().update(instance, validated_data)
        if assignee_ids is not None:
            instance.assignees.set(assignee_ids)
        return instance


class TicketStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Ticket
        fields = ['status']
