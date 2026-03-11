from rest_framework import serializers
from .models import Ticket, TicketMedia
from apps.comments.models import Comment
from apps.users.models import User
from apps.projects.models import Project


class TicketCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.StringRelatedField(source='author', read_only=True)
    user_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'author', 'user_name', 'user_username', 'content', 'created_at', 'updated_at']
        read_only_fields = ['author', 'created_at', 'updated_at']
    
    def get_user_username(self, obj):
        return obj.author.username


class TicketMediaSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.StringRelatedField(source='uploaded_by', read_only=True)
    
    class Meta:
        model = TicketMedia
        fields = ['id', 'file', 'file_name', 'file_type', 'file_size', 'uploaded_by', 'uploaded_by_username', 'created_at']
        read_only_fields = ['file_type', 'file_size', 'uploaded_by', 'created_at']
    
    def create(self, validated_data):
        file = validated_data['file']
        validated_data['file_name'] = file.name
        validated_data['file_size'] = file.size
        validated_data['uploaded_by'] = self.context['request'].user
        
        filename = file.name.lower()
        if filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg')):
            validated_data['file_type'] = 'image'
        elif filename.endswith(('.mp4', '.webm', '.mov', '.avi', '.mkv')):
            validated_data['file_type'] = 'video'
        elif filename.endswith(('.pdf', '.doc', '.docx', '.txt', '.md', '.xls', '.xlsx', '.ppt', '.pptx')):
            validated_data['file_type'] = 'document'
        else:
            validated_data['file_type'] = 'other'
        
        return super().create(validated_data)


class TicketAssigneeSerializer(serializers.Serializer):
    """Nested serializer for assignee in list"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    
    def to_representation(self, instance):
        return {
            'id': instance.id,
            'username': instance.username,
            'first_name': instance.first_name or '',
            'last_name': instance.last_name or '',
            'display_name': f"{instance.first_name or ''} {instance.last_name or ''}".strip() or instance.username,
        }


class TicketSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    assignees = serializers.SerializerMethodField()
    assignees_list = serializers.SerializerMethodField()
    project_name = serializers.StringRelatedField(source='project', read_only=True)
    media_files = TicketMediaSerializer(many=True, read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'title', 'description', 'type', 'priority', 'status',
            'project', 'project_name', 'assignees', 'assignees_list', 'created_by',
            'created_at', 'updated_at', 'media_files', 'comments',
            'in_progress_at', 'qa_at', 'closed_at'
        ]
        read_only_fields = ['ticket_id', 'created_by', 'created_at', 'updated_at', 'in_progress_at', 'qa_at', 'closed_at']
    
    def get_assignees(self, obj):
        """Return list of assignee IDs for API compatibility"""
        return list(obj.assignees.values_list('id', flat=True))
    
    def get_assignees_list(self, obj):
        """Return full assignee objects for display"""
        return [
            {
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name or '',
                'last_name': u.last_name or '',
                'display_name': f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username,
            }
            for u in obj.assignees.all()
        ]


class TicketCreateSerializer(serializers.ModelSerializer):
    media_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True
    )
    assignees = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'project', 'assignees', 'media_files']
    
    def create(self, validated_data):
        media_files = validated_data.pop('media_files', [])
        assignee_ids = validated_data.pop('assignees', [])
        validated_data['created_by'] = self.context['request'].user
        ticket = super().create(validated_data)
        
        if assignee_ids:
            ticket.assignees.set(assignee_ids)
        
        for file in media_files:
            TicketMedia.objects.create(
                ticket=ticket,
                file=file,
                file_name=file.name,
                file_size=file.size,
                uploaded_by=validated_data['created_by'],
                file_type=self._get_file_type(file.name)
            )
        
        return ticket
    
    def _get_file_type(self, filename):
        filename = filename.lower()
        if filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg')):
            return 'image'
        elif filename.endswith(('.mp4', '.webm', '.mov', '.avi', '.mkv')):
            return 'video'
        elif filename.endswith(('.pdf', '.doc', '.docx', '.txt', '.md', '.xls', '.xlsx', '.ppt', '.pptx')):
            return 'document'
        return 'other'


class TicketUpdateSerializer(serializers.ModelSerializer):
    assignees = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'status', 'assignees']
    
    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignees', None)
        instance = super().update(instance, validated_data)
        if assignee_ids is not None:
            instance.assignees.set(assignee_ids)
        return instance


class TicketStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['status']
