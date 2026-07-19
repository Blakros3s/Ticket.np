from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.customers.views.server_tenants import ServerPlanViewSet, ServerTenantViewSet

router = DefaultRouter()
router.register(r'tenants', ServerTenantViewSet, basename='server-tenants')
router.register(r'plans', ServerPlanViewSet, basename='server-plans')

urlpatterns = [
    path('', include(router.urls)),
]
