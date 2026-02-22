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


class TicketSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    assignee_name = serializers.StringRelatedField(source='assignee', read_only=True)
    assignee_username = serializers.SerializerMethodField()
    project_name = serializers.StringRelatedField(source='project', read_only=True)
    media_files = TicketMediaSerializer(many=True, read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'title', 'description', 'type', 'priority', 'status',
            'project', 'project_name', 'assignee', 'assignee_name', 'assignee_username', 'created_by',
            'created_at', 'updated_at', 'media_files', 'comments',
            'in_progress_at', 'qa_at', 'closed_at'
        ]
        read_only_fields = ['ticket_id', 'created_by', 'created_at', 'updated_at', 'in_progress_at', 'qa_at', 'closed_at']
    
    def get_assignee_username(self, obj):
        return obj.assignee.username if obj.assignee else None


class TicketCreateSerializer(serializers.ModelSerializer):
    media_files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'project', 'assignee', 'media_files']
    
    def create(self, validated_data):
        media_files = validated_data.pop('media_files', [])
        validated_data['created_by'] = self.context['request'].user
        ticket = super().create(validated_data)
        
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
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'status', 'assignee']


class TicketStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['status']
