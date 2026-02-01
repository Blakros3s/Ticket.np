from rest_framework import serializers
from .models import Project, ProjectMember
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
    
    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'status',
            'created_by', 'members', 'member_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    def get_member_count(self, obj):
        return obj.members.count()


class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['name', 'description', 'status']
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
