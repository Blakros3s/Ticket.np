from rest_framework import serializers
from .models import Comment
from apps.users.serializers import UserSerializer


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.username', read_only=True)
    author = UserSerializer(read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'ticket', 'author', 'author_name', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'author']


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['ticket', 'content']
