from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.core.views import health_check
from apps.platform.admin_site import platform_admin_site

urlpatterns = [
    path('admin/', platform_admin_site.urls),
    path('health/', health_check, name='health_check'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('apps.users.urls')),
    path('api/server/auth/', include('apps.platform.urls')),
    path('api/server/', include('apps.customers.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/timelogs/', include('apps.timelogs.urls')),
    path('api/comments/', include('apps.comments.urls')),
    path('api/activity/', include('apps.activity.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/calendar/', include('apps.calendar.urls')),
    path('api/todos/', include('apps.todos.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.core.urls')),
]

# Uploaded files are served through authenticated / signed URLs at /api/media/...
# Do not expose MEDIA_ROOT publicly in production.
