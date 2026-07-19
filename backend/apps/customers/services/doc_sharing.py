import uuid
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from apps.customers.models import PublicDocShareAccessLog, PublicDocShareIndex
from apps.workspace_docs.models import DocShareLink, WorkspaceDoc


@transaction.atomic
def create_public_share(*, doc: WorkspaceDoc, created_by, tenant_schema: str, expires_at=None) -> DocShareLink:
    token = uuid.uuid4()
    link = DocShareLink.objects.create(
        id=token,
        doc=doc,
        created_by=created_by,
        expires_at=expires_at,
    )
    with schema_context(get_public_schema_name()):
        PublicDocShareIndex.objects.create(
            token=token,
            tenant_schema=tenant_schema,
            doc_id=doc.id,
            expires_at=expires_at,
        )
    return link


@transaction.atomic
def revoke_public_share(link: DocShareLink) -> None:
    link.is_active = False
    link.save(update_fields=['is_active'])
    with schema_context(get_public_schema_name()):
        PublicDocShareIndex.objects.filter(token=link.id).update(is_active=False)


def resolve_public_share(token: uuid.UUID):
    with schema_context(get_public_schema_name()):
        index = (
            PublicDocShareIndex.objects.filter(token=token, is_active=True)
            .first()
        )
        if index is None:
            return None
        if index.expires_at and index.expires_at <= timezone.now():
            return None
    return index


def log_public_share_access(index: PublicDocShareIndex, ip_address: str | None) -> None:
    with schema_context(get_public_schema_name()):
        PublicDocShareAccessLog.objects.create(
            share_index=index,
            ip_address=ip_address,
        )
