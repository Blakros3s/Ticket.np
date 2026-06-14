from django.urls import path, re_path
from .views import health_check
from .media_views import protected_media

app_name = 'core'

urlpatterns = [
    path('health/', health_check, name='health_check'),
    re_path(r'^media/(?P<path>.+)$', protected_media, name='protected-media'),
]
