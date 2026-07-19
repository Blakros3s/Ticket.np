from django.urls import path

from .views import (
    github_connect,
    github_disconnect,
    github_oauth_callback,
    github_repos,
    github_status,
    github_webhook,
)

urlpatterns = [
    path('github/status/', github_status, name='github-status'),
    path('github/connect/', github_connect, name='github-connect'),
    path('github/disconnect/', github_disconnect, name='github-disconnect'),
    path('github/repos/', github_repos, name='github-repos'),
]

public_urlpatterns = [
    path('api/public/integrations/github/callback/', github_oauth_callback, name='github-oauth-callback'),
    path(
        'api/public/integrations/github/webhook/<slug:tenant_slug>/',
        github_webhook,
        name='github-webhook',
    ),
]
