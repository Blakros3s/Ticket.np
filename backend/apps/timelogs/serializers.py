from rest_framework import serializers
from .models import WorkLog


class WorkLogSerializer(serializers.ModelSerializer):
    user_name = serializers.StringRelatedField(source='user', read_only=True)
    ticket_id_display = serializers.StringRelatedField(source='ticket', read_only=True)
    
    class Meta:
        model = WorkLog
        fields = [
            'id', 'ticket', 'ticket_id_display', 'user', 'user_name',
            'start_time', 'end_time', 'duration_minutes', 'notes', 'created_at'
        ]
        read_only_fields = ['duration_minutes', 'created_at']


class WorkLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLog
        fields = ['ticket', 'notes']


class WorkLogUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLog
        fields = ['notes']
