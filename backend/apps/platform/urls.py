from django.urls import path

from apps.platform.views import PlatformProfileView, PlatformTokenObtainPairView, PlatformTokenRefreshView

urlpatterns = [
    path('login/', PlatformTokenObtainPairView.as_view(), name='platform_login'),
    path('token/refresh/', PlatformTokenRefreshView.as_view(), name='platform_token_refresh'),
    path('profile/', PlatformProfileView.as_view(), name='platform_profile'),
]
