from django.utils import timezone
from rest_framework import serializers

from apps.notifications.email_utils import get_frontend_base_url
from apps.workspace_docs.models import DocShareLink, WorkspaceDoc


def empty_doc_content() -> dict:
    return {
        'type': 'doc',
        'content': [
            {'type': 'heading', 'attrs': {'level': 1}},
            {'type': 'paragraph'},
        ],
    }


class WorkspaceDocListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    last_edited_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    is_starred = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceDoc
        fields = [
            'id', 'title', 'emoji', 'project', 'project_name', 'created_by', 'created_by_name',
            'last_edited_by', 'last_edited_by_name', 'is_starred',
            'is_archived', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_last_edited_by_name(self, obj):
        if not obj.last_edited_by:
            return None
        return obj.last_edited_by.get_full_name() or obj.last_edited_by.username

    def get_is_starred(self, obj):
        starred_ids = self.context.get('starred_doc_ids')
        if starred_ids is not None:
            return obj.id in starred_ids
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.stars.filter(user=request.user).exists()


class WorkspaceDocSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    last_edited_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    is_starred = serializers.SerializerMethodField()
    expected_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = WorkspaceDoc
        fields = [
            'id', 'title', 'emoji', 'content', 'project', 'project_name', 'created_by', 'created_by_name',
            'last_edited_by', 'last_edited_by_name', 'is_starred',
            'is_archived', 'created_at', 'updated_at', 'expected_updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'last_edited_by', 'last_edited_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_last_edited_by_name(self, obj):
        if not obj.last_edited_by:
            return None
        return obj.last_edited_by.get_full_name() or obj.last_edited_by.username

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.stars.filter(user=request.user).exists()

    def validate_content(self, value):
        if value is None:
            return empty_doc_content()
        if not isinstance(value, dict):
            raise serializers.ValidationError('Content must be a JSON object.')
        if value.get('type') != 'doc':
            raise serializers.ValidationError('Content root must be type "doc".')
        return value

    def validate(self, attrs):
        project = attrs.get('project', getattr(self.instance, 'project', None))
        request = self.context.get('request')
        user = request.user if request else None

        if self.instance is None and project and user and user.role == 'employee':
            from apps.core.access import user_can_access_project
            if not user_can_access_project(user, project):
                raise serializers.ValidationError({'project': 'You are not a member of this project.'})

        return attrs

    def update(self, instance, validated_data):
        expected = validated_data.pop('expected_updated_at', None)
        if expected is not None and instance.updated_at.isoformat() > expected.isoformat():
            raise serializers.ValidationError({
                'detail': 'This document was updated by someone else. Reload to see the latest version.',
                'code': 'stale_document',
                'updated_at': instance.updated_at.isoformat(),
            })

        content_changed = 'content' in validated_data and validated_data['content'] != instance.content
        validated_data['last_edited_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)

        if content_changed:
            from apps.workspace_docs.models import DocVersion
            DocVersion.objects.create(
                doc=instance,
                content=instance.content,
                edited_by=self.context['request'].user,
            )
        return instance


class WorkspaceDocCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceDoc
        fields = ['id', 'title', 'emoji', 'content', 'project']
        read_only_fields = ['id']

    def validate_content(self, value):
        if not value:
            return empty_doc_content()
        return WorkspaceDocSerializer(context=self.context).validate_content(value)

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['last_edited_by'] = user
        if not validated_data.get('content'):
            validated_data['content'] = empty_doc_content()
        if not validated_data.get('title'):
            validated_data['title'] = 'Untitled'
        return super().create(validated_data)


class DocShareLinkSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = DocShareLink
        fields = ['id', 'doc', 'is_active', 'expires_at', 'created_at', 'public_url']
        read_only_fields = ['id', 'doc', 'is_active', 'created_at', 'public_url']

    def get_public_url(self, obj):
        request = self.context.get('request')
        base = get_frontend_base_url(request)
        return f'{base}/share/docs/{obj.id}'


class DocShareCreateSerializer(serializers.Serializer):
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError('Expiry must be in the future.')
        return value
