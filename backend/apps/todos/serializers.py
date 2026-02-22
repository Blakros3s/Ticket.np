from rest_framework import serializers
from .models import TodoItem


class TodoItemSerializer(serializers.ModelSerializer):
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_color = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = TodoItem
        fields = [
            'id', 'title', 'description', 'priority', 'priority_display', 'priority_color',
            'status', 'status_display', 'due_date', 'due_time', 'is_completed',
            'completed_at', 'is_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'completed_at']
    
    def get_priority_color(self, obj):
        return TodoItem.PRIORITY_COLORS.get(obj.priority, '#6b7280')
    
    def get_is_overdue(self, obj):
        if not obj.due_date or obj.is_completed:
            return False
        from django.utils import timezone
        from datetime import datetime
        due_datetime = datetime.combine(obj.due_date, obj.due_time or datetime.min.time())
        if timezone.is_naive(due_datetime):
            due_datetime = timezone.make_aware(due_datetime)
        return due_datetime < timezone.now()


class TodoItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoItem
        fields = [
            'id', 'title', 'description', 'priority', 'status',
            'due_date', 'due_time', 'is_completed'
        ]
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TodoItemListSerializer(serializers.ModelSerializer):
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_color = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = TodoItem
        fields = [
            'id', 'title', 'description', 'priority', 'priority_display', 'priority_color',
            'status', 'status_display', 'due_date', 'due_time', 'is_completed', 'is_overdue'
        ]
    
    def get_priority_color(self, obj):
        return TodoItem.PRIORITY_COLORS.get(obj.priority, '#6b7280')
    
    def get_is_overdue(self, obj):
        if not obj.due_date or obj.is_completed:
            return False
        from django.utils import timezone
        from datetime import datetime
        due_datetime = datetime.combine(obj.due_date, obj.due_time or datetime.min.time())
        if timezone.is_naive(due_datetime):
            due_datetime = timezone.make_aware(due_datetime)
        return due_datetime < timezone.now()
