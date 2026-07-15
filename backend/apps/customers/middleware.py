from django.conf import settings
from django.db import connection
from django.http import Http404
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import UntypedToken

from apps.customers.tenant_resolution import (
    is_public_api_path,
    is_tenant_login_path,
    resolve_tenant,
    set_public_schema,
    set_tenant,
)


class TenantResolutionMiddleware:
    """
    Same-domain multitenancy: resolve tenant from JWT or X-Tenant-Schema header.

    Public schema routes (/api/server/*) are always served from public.
    Tenant business APIs share one host (e.g. localhost:8000).
    """

    HEADER = 'X-Tenant-Schema'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/'):
            set_public_schema()
            return self.get_response(request)

        if is_public_api_path(request.path):
            set_public_schema()
            return self.get_response(request)

        # Login resolves organization in the serializer; keep public for registry lookup.
        if is_tenant_login_path(request.path, request.method):
            set_public_schema()
            return self.get_response(request)

        tenant = (
            self._tenant_from_authorization(request)
            or self._tenant_from_header(request)
        )

        if tenant is not None:
            set_tenant(tenant)
            request.tenant = tenant
            request.urlconf = settings.ROOT_URLCONF
            return self.get_response(request)

        if getattr(settings, 'SHOW_PUBLIC_IF_NO_TENANT_FOUND', True):
            set_public_schema()
            return self.get_response(request)

        raise Http404('No tenant for hostname')

    def _tenant_from_header(self, request):
        schema = request.headers.get(self.HEADER, '').strip()
        if not schema:
            return None
        return resolve_tenant(schema)

    def _tenant_from_authorization(self, request):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return self._tenant_from_refresh_body(request)

        raw = auth[7:].strip()
        if not raw:
            return None

        schema = self._schema_from_token(raw)
        if not schema:
            return None
        return resolve_tenant(schema)

    def _tenant_from_refresh_body(self, request):
        if request.path.rstrip('/') != '/api/auth/token/refresh':
            return None
        if request.method != 'POST':
            return None

        try:
            import json
            body = json.loads(request.body or b'{}')
        except (json.JSONDecodeError, ValueError):
            return None

        refresh = body.get('refresh')
        if not refresh:
            return None

        schema = self._schema_from_token(refresh)
        if not schema:
            return None
        return resolve_tenant(schema)

    @staticmethod
    def _schema_from_token(raw_token: str) -> str | None:
        try:
            token = UntypedToken(raw_token)
        except TokenError:
            return None
        return token.get('tenant_schema') or None
