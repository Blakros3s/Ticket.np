from rest_framework import serializers

from apps.integrations.models import GitHubConnection, TicketGitHubLink


class GitHubConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubConnection
        fields = [
            'id',
            'github_login',
            'github_user_id',
            'token_scope',
            'connected_at',
            'updated_at',
        ]
        read_only_fields = fields


class GitHubRepoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    html_url = serializers.URLField()
    private = serializers.BooleanField()
    description = serializers.CharField(allow_blank=True, allow_null=True)


class TicketGitHubLinkSerializer(serializers.ModelSerializer):
    linked_by_login = serializers.SerializerMethodField()

    class Meta:
        model = TicketGitHubLink
        fields = [
            'repo_owner',
            'repo_name',
            'issue_number',
            'issue_url',
            'sync_status',
            'last_sync_error',
            'last_synced_at',
            'linked_by_login',
            'created_at',
        ]
        read_only_fields = fields

    def get_linked_by_login(self, obj):
        if obj.linked_by_id and obj.linked_by:
            connection = getattr(obj.linked_by, 'github_connection', None)
            if connection:
                return connection.github_login
        return None
