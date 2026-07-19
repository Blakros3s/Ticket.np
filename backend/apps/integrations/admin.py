from django.contrib import admin

from .models import GitHubConnection, TicketGitHubLink


@admin.register(GitHubConnection)
class GitHubConnectionAdmin(admin.ModelAdmin):
    list_display = ('github_login', 'connected_by', 'connected_at')
    readonly_fields = ('github_user_id', 'github_login', 'connected_at', 'updated_at')


@admin.register(TicketGitHubLink)
class TicketGitHubLinkAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'repo_owner', 'repo_name', 'issue_number', 'sync_status')
    search_fields = ('ticket__ticket_id', 'repo_owner', 'repo_name')
