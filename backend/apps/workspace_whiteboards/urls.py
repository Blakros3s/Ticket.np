from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.workspace_whiteboards.views import WhiteboardShareLinkViewSet, WhiteboardViewSet

router = DefaultRouter()
router.register('whiteboards', WhiteboardViewSet, basename='workspace-whiteboard')
router.register('share', WhiteboardShareLinkViewSet, basename='workspace-whiteboard-share')

urlpatterns = [
    path('', include(router.urls)),
]
