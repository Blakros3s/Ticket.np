from rest_framework import serializers
from django.utils import timezone

from apps.notifications.email_utils import get_frontend_base_url
from apps.workspace_whiteboards.models import Whiteboard, WhiteboardShareLink


def empty_whiteboard_canvas() -> dict:
    return {'version': 1, 'elements': [], 'camera': {'x': 0, 'y': 0, 'zoom': 1}}


class WhiteboardListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    last_edited_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)

    class Meta:
        model = Whiteboard
        fields = [
            'id', 'title', 'project', 'project_name', 'created_by', 'created_by_name',
            'last_edited_by', 'last_edited_by_name', 'is_archived', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_last_edited_by_name(self, obj):
        if not obj.last_edited_by:
            return None
        return obj.last_edited_by.get_full_name() or obj.last_edited_by.username


class WhiteboardSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    last_edited_by_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)
    expected_updated_at = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = Whiteboard
        fields = [
            'id', 'title', 'canvas_data', 'project', 'project_name', 'created_by', 'created_by_name',
            'last_edited_by', 'last_edited_by_name', 'is_archived', 'created_at', 'updated_at',
            'expected_updated_at',
        ]
        read_only_fields = [
            'id', 'created_by', 'created_by_name', 'last_edited_by', 'last_edited_by_name',
            'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_last_edited_by_name(self, obj):
        if not obj.last_edited_by:
            return None
        return obj.last_edited_by.get_full_name() or obj.last_edited_by.username

    def validate_canvas_data(self, value):
        if value is None:
            return empty_whiteboard_canvas()
        if not isinstance(value, dict):
            raise serializers.ValidationError('Canvas data must be a JSON object.')
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
                'detail': 'This whiteboard was updated by someone else. Reload to see the latest version.',
                'code': 'stale_whiteboard',
                'updated_at': instance.updated_at.isoformat(),
            })

        canvas_changed = (
            'canvas_data' in validated_data
            and validated_data['canvas_data'] != instance.canvas_data
        )
        validated_data['last_edited_by'] = self.context['request'].user
        instance = super().update(instance, validated_data)

        if canvas_changed:
            from apps.workspace_whiteboards.models import WhiteboardVersion
            WhiteboardVersion.objects.create(
                whiteboard=instance,
                canvas_data=instance.canvas_data,
                edited_by=self.context['request'].user,
            )
        return instance


class WhiteboardCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Whiteboard
        fields = ['id', 'title', 'canvas_data', 'project']
        read_only_fields = ['id']

    def validate_canvas_data(self, value):
        if not value:
            return empty_whiteboard_canvas()
        return WhiteboardSerializer(context=self.context).validate_canvas_data(value)

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['last_edited_by'] = user
        if not validated_data.get('canvas_data'):
            validated_data['canvas_data'] = empty_whiteboard_canvas()
        if not validated_data.get('title'):
            validated_data['title'] = 'Untitled'
        return super().create(validated_data)


class ConvertElementSerializer(serializers.Serializer):
    element_id = serializers.CharField(max_length=128)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_element_id(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('element_id is required.')
        return cleaned

    def validate_title(self, value):
        return value.strip() if value else ''


class WhiteboardShareLinkSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = WhiteboardShareLink
        fields = ['id', 'whiteboard', 'is_active', 'expires_at', 'created_at', 'public_url']
        read_only_fields = ['id', 'whiteboard', 'is_active', 'created_at', 'public_url']

    def get_public_url(self, obj):
        request = self.context.get('request')
        base = get_frontend_base_url(request)
        return f'{base}/share/whiteboards/{obj.id}'


class WhiteboardShareCreateSerializer(serializers.Serializer):
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError('Expiry must be in the future.')
        return value
