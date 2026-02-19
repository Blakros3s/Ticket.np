from rest_framework import serializers
from .models import CalendarEvent
from apps.users.serializers import UserSerializer


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'date', 'category', 'category_display',
            'color', 'is_full_day', 'start_time', 'end_time',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class CalendarEventCreateSerializer(serializers.ModelSerializer):
    color = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.TimeField(required=False, allow_null=True)
    end_time = serializers.TimeField(required=False, allow_null=True)
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'date', 'category',
            'color', 'is_full_day', 'start_time', 'end_time'
        ]
    
    def to_internal_value(self, data):
        # Convert empty strings to None for time fields
        if 'start_time' in data and data['start_time'] == '':
            data['start_time'] = None
        if 'end_time' in data and data['end_time'] == '':
            data['end_time'] = None
        return super().to_internal_value(data)
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        # Remove color if empty so model's save() can auto-assign it
        if 'color' in validated_data and not validated_data['color']:
            validated_data.pop('color')
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Remove color if empty so model's save() can auto-assign it
        if 'color' in validated_data and not validated_data['color']:
            validated_data.pop('color')
        return super().update(instance, validated_data)


class CalendarEventListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = CalendarEvent
        fields = ['id', 'title', 'description', 'date', 'category', 'category_display', 'color', 'is_full_day', 'start_time', 'end_time']
