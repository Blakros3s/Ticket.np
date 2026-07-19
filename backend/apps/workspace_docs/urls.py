from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.workspace_docs.views import DocShareLinkViewSet, WorkspaceDocViewSet

router = DefaultRouter()
router.register('docs', WorkspaceDocViewSet, basename='workspace-doc')
router.register('share', DocShareLinkViewSet, basename='workspace-doc-share')

urlpatterns = [
    path('', include(router.urls)),
]
