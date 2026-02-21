from rest_framework import serializers
from .models import Project, ProjectMember, ProjectDocument
from apps.users.models import User
from apps.users.serializers import UserSerializer


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True
    )
    
    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'user_id', 'joined_at']
        read_only_fields = ['joined_at']


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members = ProjectMemberSerializer(source='projectmember_set', many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    ticket_count = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'github_repo', 'status',
            'created_by', 'members', 'member_count', 'ticket_count', 'document_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_ticket_count(self, obj):
        return obj.tickets.count()
    
    def get_document_count(self, obj):
        return obj.documents.count()


class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['name', 'description', 'github_repo', 'status']
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)
    
    class Meta:
        model = ProjectDocument
        fields = ['id', 'title', 'file', 'file_type', 'file_size', 'uploaded_by', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at', 'file_type', 'file_size']
    
    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        validated_data['file_size'] = validated_data['file'].size
        
        # Determine file type
        filename = validated_data['file'].name.lower()
        if filename.endswith('.pdf'):
            validated_data['file_type'] = 'pdf'
        elif filename.endswith('.doc'):
            validated_data['file_type'] = 'doc'
        elif filename.endswith('.docx'):
            validated_data['file_type'] = 'docx'
        elif filename.endswith('.md'):
            validated_data['file_type'] = 'md'
        elif filename.endswith('.txt'):
            validated_data['file_type'] = 'txt'
        elif filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            validated_data['file_type'] = 'image'
        else:
            validated_data['file_type'] = 'other'
        
        return super().create(validated_data)
