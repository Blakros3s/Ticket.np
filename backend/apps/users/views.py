import logging
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, AuthenticationFailed
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, RegisterSerializer, CustomTokenObtainPairSerializer
from .permissions import IsAdminUser

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            logger.info(f"User registered successfully: {user.username}")

            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            logger.warning(f"Registration validation failed: {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response({'detail': 'Registration failed. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            logger.info(f"Successful login attempt for username: {request.data.get('username')}")
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        except ValidationError as e:
            logger.warning(f"Validation error during login for username: {request.data.get('username')} - {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except AuthenticationFailed as e:
            logger.warning(f"Authentication failed for username: {request.data.get('username')} - {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': 'Invalid username or password'}
            return Response(error_detail, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.error(f"Unexpected error during login for username: {request.data.get('username')} - {str(e)}")
            return Response({'detail': 'An error occurred during login. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_object(self):
        return User.objects.get(id=self.kwargs.get('pk'))
    def get(self, request, *args, **kwargs):
        try:
            logger.info(f"Profile request for user: {request.user.username}")
            return super().get(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error retrieving profile for user {request.user.username}: {str(e)}")
            return Response({'detail': 'Failed to retrieve profile'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, *args, **kwargs):
        try:
            logger.info(f"Profile update request for user: {request.user.username}")
            return super().patch(request, *args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Profile update validation failed for user {request.user.username}: {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Profile update error for user {request.user.username}: {str(e)}")
            return Response({'detail': 'Failed to update profile'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
