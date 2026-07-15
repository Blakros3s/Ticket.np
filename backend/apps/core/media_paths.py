"""Tenant-scoped media path helpers."""

from __future__ import annotations

import os
import re

from django.db import connection

MEDIA_PREFIXES = ('ticket_media', 'project_documents')
_SCHEMA_PREFIX_RE = re.compile(r'^[a-z][a-z0-9_]*$')


def get_current_schema_name() -> str:
    return getattr(connection, 'schema_name', '') or 'public'


def tenant_scoped_upload_path(relative_path: str) -> str:
    """Prefix upload paths with the active tenant schema."""
    schema = get_current_schema_name()
    if schema and schema != 'public':
        return f'{schema}/{relative_path}'
    return relative_path


def parse_scoped_media_path(path: str) -> tuple[str | None, str, int]:
    """
    Parse ticket/project media paths.

    Supports:
      - {schema}/ticket_media/{id}/file.ext
      - ticket_media/{id}/file.ext  (legacy)
    """
    parts = [p for p in path.split('/') if p]
    if len(parts) < 2:
        raise ValueError('Invalid media path.')

    if parts[0] in MEDIA_PREFIXES:
        media_type = parts[0]
        resource_id = int(parts[1])
        return None, media_type, resource_id

    if len(parts) < 3:
        raise ValueError('Invalid media path.')

    schema, media_type, resource_id_str = parts[0], parts[1], parts[2]
    if media_type not in MEDIA_PREFIXES or not _SCHEMA_PREFIX_RE.match(schema):
        raise ValueError('Invalid media path.')

    return schema, media_type, int(resource_id_str)


def assert_media_schema_access(requested_schema: str | None) -> None:
    """Reject cross-tenant media access when the path includes a schema prefix."""
    if not requested_schema:
        return

    current_schema = get_current_schema_name()
    if current_schema == 'public':
        return

    if requested_schema != current_schema:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied('You do not have access to this file.')
