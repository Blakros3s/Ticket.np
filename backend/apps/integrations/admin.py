from django.contrib import admin

from .models import GitHubConnection, GitHubTenantConfig, TicketGitHubLink


@admin.register(GitHubTenantConfig)
class GitHubTenantConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'updated_at')
    readonly_fields = ('updated_at')


@admin.register(GitHubConnection)
class GitHubConnectionAdmin(admin.ModelAdmin):
    list_display = ('user', 'github_login', 'connected_at')
    readonly_fields = ('github_user_id', 'github_login', 'connected_at', 'updated_at')
    search_fields = ('user__username', 'github_login')


@admin.register(TicketGitHubLink)
class TicketGitHubLinkAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'repo_owner', 'repo_name', 'issue_number', 'linked_by', 'sync_status')
    search_fields = ('ticket__ticket_id', 'repo_owner', 'repo_name')
