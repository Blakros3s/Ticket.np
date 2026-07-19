import uuid

from django.db import transaction
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import PublicWhiteboardShareAccessLog, PublicWhiteboardShareIndex
from apps.workspace_whiteboards.models import Whiteboard, WhiteboardShareLink


@transaction.atomic
def create_public_whiteboard_share(
    *,
    whiteboard: Whiteboard,
    created_by,
    tenant_schema: str,
    expires_at=None,
) -> WhiteboardShareLink:
    token = uuid.uuid4()
    link = WhiteboardShareLink.objects.create(
        id=token,
        whiteboard=whiteboard,
        created_by=created_by,
        expires_at=expires_at,
    )
    with schema_context(get_public_schema_name()):
        PublicWhiteboardShareIndex.objects.create(
            token=token,
            tenant_schema=tenant_schema,
            whiteboard_id=whiteboard.id,
            expires_at=expires_at,
        )
    return link


@transaction.atomic
def revoke_public_whiteboard_share(link: WhiteboardShareLink) -> None:
    link.is_active = False
    link.save(update_fields=['is_active'])
    with schema_context(get_public_schema_name()):
        PublicWhiteboardShareIndex.objects.filter(token=link.id).update(is_active=False)


def resolve_public_whiteboard_share(token: uuid.UUID):
    with schema_context(get_public_schema_name()):
        index = (
            PublicWhiteboardShareIndex.objects.filter(token=token, is_active=True)
            .first()
        )
        if index is None:
            return None
        if index.expires_at and index.expires_at <= timezone.now():
            return None
    return index


def log_public_whiteboard_share_access(index: PublicWhiteboardShareIndex, ip_address: str | None) -> None:
    with schema_context(get_public_schema_name()):
        PublicWhiteboardShareAccessLog.objects.create(
            share_index=index,
            ip_address=ip_address,
        )
