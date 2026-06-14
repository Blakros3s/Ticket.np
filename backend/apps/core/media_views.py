import os

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import PermissionDenied

from apps.core.access import user_can_access_project, user_can_access_ticket
from apps.core.media_utils import verify_media_signature
from apps.projects.models import Project
from apps.tickets.models import Ticket


def _resolve_media_path(path: str) -> str:
    media_root = os.path.normpath(str(settings.MEDIA_ROOT))
    full_path = os.path.normpath(os.path.join(media_root, path))
    if not full_path.startswith(media_root):
        raise PermissionDenied('Invalid media path.')
    return full_path


def _authorize_media_access(request, path: str) -> None:
    signature = request.query_params.get('sig')
    if signature:
        verify_media_signature(path, signature)
        return

    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied('Authentication required.')

    if path.startswith('ticket_media/'):
        parts = path.split('/')
        if len(parts) < 2:
            raise PermissionDenied('Invalid ticket media path.')
        try:
            ticket_id = int(parts[1])
        except ValueError as exc:
            raise PermissionDenied('Invalid ticket media path.') from exc
        try:
            ticket = Ticket.objects.select_related('project').get(pk=ticket_id)
        except Ticket.DoesNotExist as exc:
            raise Http404('Media not found.') from exc
        if not user_can_access_ticket(user, ticket):
            raise PermissionDenied('You do not have access to this file.')
        return

    if path.startswith('project_documents/'):
        parts = path.split('/')
        if len(parts) < 2:
            raise PermissionDenied('Invalid project document path.')
        try:
            project_id = int(parts[1])
        except ValueError as exc:
            raise PermissionDenied('Invalid project document path.') from exc
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist as exc:
            raise Http404('Media not found.') from exc
        if not user_can_access_project(user, project):
            raise PermissionDenied('You do not have access to this file.')
        return

    raise PermissionDenied('Unsupported media path.')


@api_view(['GET'])
@permission_classes([AllowAny])
def protected_media(request, path: str):
    _authorize_media_access(request, path)

    full_path = _resolve_media_path(path)
    if not os.path.isfile(full_path):
        raise Http404('Media not found.')

    return FileResponse(open(full_path, 'rb'))
