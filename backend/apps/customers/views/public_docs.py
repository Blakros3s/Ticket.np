from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_tenants.utils import schema_context

from apps.customers.services.doc_sharing import log_public_share_access, resolve_public_share
from apps.workspace_docs.rendering import render_doc_content_html


def _client_ip(request) -> str | None:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


@api_view(['GET'])
@permission_classes([AllowAny])
def public_shared_doc(request, token):
    index = resolve_public_share(token)
    if index is None:
        return Response({'detail': 'Share link not found or expired.'}, status=status.HTTP_404_NOT_FOUND)

    log_public_share_access(index, _client_ip(request))

    with schema_context(index.tenant_schema):
        from apps.workspace_docs.models import WorkspaceDoc

        try:
            doc = WorkspaceDoc.objects.get(pk=index.doc_id, is_archived=False)
        except WorkspaceDoc.DoesNotExist:
            return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

        active_link = doc.share_links.filter(id=token, is_active=True).first()
        if active_link is None:
            return Response({'detail': 'Share link has been revoked.'}, status=status.HTTP_404_NOT_FOUND)
        if active_link.expires_at and active_link.expires_at <= timezone.now():
            return Response({'detail': 'Share link has expired.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'title': doc.title,
            'content': doc.content,
            'content_html': render_doc_content_html(doc.content, skip_title_heading=True),
            'updated_at': doc.updated_at,
        })
