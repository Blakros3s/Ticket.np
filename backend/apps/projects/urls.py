from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.dashboard.views import export_ticket_report
from .views import ProjectViewSet, ProjectDocumentViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'projects/(?P<project_pk>[^/.]+)/documents', ProjectDocumentViewSet, basename='project-document')

urlpatterns = [
    path(
        'projects/<int:project_id>/export-tickets/',
        export_ticket_report,
        name='project-export-tickets',
    ),
    path('', include(router.urls)),
]
