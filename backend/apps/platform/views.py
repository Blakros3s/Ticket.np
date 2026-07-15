from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.platform.authentication import PlatformJWTAuthentication
from apps.platform.serializers import (
    PlatformTokenObtainPairSerializer,
    PlatformTokenRefreshSerializer,
    PlatformUserSerializer,
)


class PlatformTokenObtainPairView(TokenObtainPairView):
    serializer_class = PlatformTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class PlatformTokenRefreshView(TokenRefreshView):
    serializer_class = PlatformTokenRefreshSerializer
    permission_classes = [permissions.AllowAny]


class PlatformProfileView(generics.RetrieveAPIView):
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PlatformUserSerializer

    def get_object(self):
        return self.request.user
