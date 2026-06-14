from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        self._cleanup_old_read()
        return Notification.objects.filter(
            user=self.request.user
        ).order_by('-created_at')

    def _cleanup_old_read(self):
        cutoff = timezone.now() - timedelta(days=28)
        Notification.objects.filter(
            user=self.request.user,
            read=True,
            created_at__lt=cutoff
        ).delete()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(read=True)
        self._cleanup_old_read()
        return Response({'status': 'ok'})

    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        deleted, _ = Notification.objects.filter(user=request.user).delete()
        return Response({'status': 'ok', 'deleted': deleted})
