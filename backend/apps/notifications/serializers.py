from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'ticket_id', 'ticket_title', 'project_id', 'project_name', 'created_at', 'read']
