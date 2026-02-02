from rest_framework import serializers
from .models import ActivityLog
from apps.users.serializers import UserSerializer


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user = UserSerializer(read_only=True)
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    target_str = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityLog
        fields = [
            'id', 'action', 'user', 'user_name', 'description',
            'target_type', 'target_id', 'target_str',
            'extra_data', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_target_type(self, obj):
        if obj.content_type:
            return obj.content_type.model
        return None
    
    def get_target_id(self, obj):
        return obj.object_id
    
    def get_target_str(self, obj):
        if obj.content_object:
            return str(obj.content_object)
        return None
