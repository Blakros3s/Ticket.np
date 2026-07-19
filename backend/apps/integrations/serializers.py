from rest_framework import serializers

from apps.integrations.models import GitHubConnection, TicketGitHubLink


class GitHubConnectionSerializer(serializers.ModelSerializer):
    connected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GitHubConnection
        fields = [
            'id',
            'github_login',
            'github_user_id',
            'token_scope',
            'connected_by_name',
            'connected_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_connected_by_name(self, obj):
        if not obj.connected_by:
            return None
        return obj.connected_by.get_full_name() or obj.connected_by.username


class GitHubRepoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    html_url = serializers.URLField()
    private = serializers.BooleanField()
    description = serializers.CharField(allow_blank=True, allow_null=True)


class TicketGitHubLinkSerializer(serializers.ModelSerializer):
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
            'created_at',
        ]
        read_only_fields = fields
