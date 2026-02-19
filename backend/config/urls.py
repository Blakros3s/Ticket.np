from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('apps.users.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/timelogs/', include('apps.timelogs.urls')),
    path('api/comments/', include('apps.comments.urls')),
    path('api/activity/', include('apps.activity.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/calendar/', include('apps.calendar.urls')),
    path('api/todos/', include('apps.todos.urls')),
    path('api/', include('apps.core.urls')),
]
