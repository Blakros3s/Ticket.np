from rest_framework import serializers
from .models import Ticket
from apps.users.models import User
from apps.projects.models import Project


class TicketSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    assignee_name = serializers.StringRelatedField(source='assignee', read_only=True)
    project_name = serializers.StringRelatedField(source='project', read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'title', 'description', 'type', 'priority', 'status',
            'project', 'project_name', 'assignee', 'assignee_name', 'created_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['ticket_id', 'created_by', 'created_at', 'updated_at']


class TicketCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'project', 'assignee']
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TicketUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['title', 'description', 'type', 'priority', 'status', 'assignee']


class TicketStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['status']
