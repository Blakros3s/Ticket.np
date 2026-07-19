from django.urls import include, path

from apps.core.views import health_check

urlpatterns = [
    path('server/auth/', include('apps.platform.urls')),
    path('server/', include('apps.customers.urls')),
    path('health/', health_check, name='public_health'),
]
