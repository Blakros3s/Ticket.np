from __future__ import annotations

import json
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.customers.tenant_resolution import resolve_tenant, set_tenant
from apps.integrations.models import GitHubConnection
from apps.integrations.serializers import GitHubConnectionSerializer, GitHubRepoSerializer
from apps.integrations.services.crypto import encrypt_text
from apps.integrations.services.github_client import GitHubAPIError, GitHubClient
from apps.integrations.services.github_oauth import (
    build_authorize_url,
    exchange_code_for_token,
    fetch_github_user,
    github_oauth_configured,
    parse_oauth_state,
)
from apps.integrations.services.github_sync import (
    apply_github_issue_state_to_ticket,
    get_active_connection,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)


class IsTenantAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
        )


def _frontend_settings_url(query: str = '') -> str:
    base = f'{settings.FRONTEND_URL.rstrip("/")}/protected/dashboard/settings'
    return f'{base}{query}'


def _require_github_feature(request) -> Response | None:
    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        return Response({'detail': 'Tenant context is required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        from apps.customers.services.plans import requires_feature
        requires_feature(tenant, 'github_integration_enabled')
    except Exception as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantAdmin])
def github_status(request):
    configured = github_oauth_configured()
    feature_enabled = True
    feature_detail = ''

    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        return Response({'detail': 'Tenant context is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from apps.customers.services.plans import requires_feature
        requires_feature(tenant, 'github_integration_enabled')
    except Exception as exc:
        feature_enabled = False
        feature_detail = str(exc.detail) if hasattr(exc, 'detail') else str(exc)

    connection = get_active_connection()
    if not connection:
        return Response({
            'connected': False,
            'configured': configured,
            'feature_enabled': feature_enabled,
            'feature_detail': feature_detail,
        })

    return Response({
        'connected': True,
        'configured': configured,
        'feature_enabled': feature_enabled,
        'feature_detail': feature_detail,
        'connection': GitHubConnectionSerializer(connection).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantAdmin])
def github_connect(request):
    blocked = _require_github_feature(request)
    if blocked:
        return blocked

    if not github_oauth_configured():
        return Response(
            {'detail': 'GitHub OAuth is not configured on the server.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    tenant = request.tenant
    authorize_url = build_authorize_url(tenant.slug, request.user.id)
    return Response({'authorize_url': authorize_url})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTenantAdmin])
def github_disconnect(request):
    blocked = _require_github_feature(request)
    if blocked:
        return blocked

    GitHubConnection.objects.all().delete()
    return Response({'connected': False})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def github_repos(request):
    blocked = _require_github_feature(request)
    if blocked:
        return blocked

    client = None
    from apps.integrations.services.github_sync import get_github_client
    client = get_github_client()
    if not client:
        return Response({'detail': 'GitHub is not connected.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        repos = client.list_repos()
    except GitHubAPIError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    serializer = GitHubRepoSerializer(repos, many=True)
    return Response(serializer.data)


@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def github_oauth_callback(request):
    error = request.GET.get('error')
    if error:
        return HttpResponseRedirect(_frontend_settings_url('?github=error'))

    code = request.GET.get('code', '').strip()
    state = request.GET.get('state', '').strip()
    if not code or not state:
        return HttpResponseRedirect(_frontend_settings_url('?github=error'))

    try:
        tenant_slug, user_id = parse_oauth_state(state)
    except ValueError:
        return HttpResponseRedirect(_frontend_settings_url('?github=error'))

    tenant = resolve_tenant(tenant_slug)
    if tenant is None:
        return HttpResponseRedirect(_frontend_settings_url('?github=error'))

    try:
        token_payload = exchange_code_for_token(code)
        access_token = token_payload['access_token']
        github_user = fetch_github_user(access_token)
    except (ValueError, KeyError) as exc:
        logger.warning('GitHub OAuth callback failed: %s', exc)
        return HttpResponseRedirect(_frontend_settings_url('?github=error'))

    with schema_context(tenant.schema_name):
        set_tenant(tenant)
        from apps.users.models import User
        connected_by = User.objects.filter(pk=user_id).first()

        GitHubConnection.objects.all().delete()
        GitHubConnection.objects.create(
            github_user_id=github_user['id'],
            github_login=github_user['login'],
            access_token_encrypted=encrypt_text(access_token),
            token_scope=token_payload.get('scope', ''),
            connected_by=connected_by,
        )

    return HttpResponseRedirect(_frontend_settings_url('?github=connected'))


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def github_webhook(request, tenant_slug: str):
    tenant = resolve_tenant(tenant_slug)
    if tenant is None:
        return HttpResponse(status=404)

    payload_bytes = request.body
    try:
        event = json.loads(payload_bytes.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return HttpResponse(status=400)

    event_name = request.headers.get('X-GitHub-Event', '')
    if event_name != 'issues':
        return HttpResponse(status=200)

    action = event.get('action')
    if action not in {'closed', 'reopened'}:
        return HttpResponse(status=200)

    issue = event.get('issue') or {}
    repository = event.get('repository') or {}
    owner = (repository.get('owner') or {}).get('login')
    repo_name = repository.get('name')
    issue_number = issue.get('number')
    github_state = issue.get('state')
    actor_login = (event.get('sender') or {}).get('login')

    if not owner or not repo_name or not issue_number:
        return HttpResponse(status=200)

    with schema_context(tenant.schema_name):
        set_tenant(tenant)
        connection = get_active_connection()
        if connection is None:
            return HttpResponse(status=200)

        signature = request.headers.get('X-Hub-Signature-256')
        if connection.webhook_secret and not verify_webhook_signature(
            payload_bytes,
            signature,
            connection.webhook_secret,
        ):
            return HttpResponse(status=401)

        apply_github_issue_state_to_ticket(
            owner=owner,
            repo=repo_name,
            issue_number=issue_number,
            github_state=github_state,
            actor_login=actor_login,
        )

    return HttpResponse(status=200)
