from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProjectDocumentViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'projects/(?P<project_pk>[^/.]+)/documents', ProjectDocumentViewSet, basename='project-document')

urlpatterns = [
    path('', include(router.urls)),
]
