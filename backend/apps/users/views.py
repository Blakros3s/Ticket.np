import logging
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, AuthenticationFailed
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from .models import User
from .serializers import UserSerializer, RegisterSerializer, CustomTokenObtainPairSerializer
from .permissions import IsAdminUser

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """Allow user to change their own password"""
    user = request.user
    
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')
    
    if not current_password or not new_password or not confirm_password:
        return Response(
            {'error': 'Current password, new password, and confirmation are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if new_password != confirm_password:
        return Response(
            {'error': 'New passwords do not match'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not check_password(current_password, user.password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.set_password(new_password)
    user.save()
    
    logger.info(f"Password changed successfully for user: {user.username}")
    
    return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_reset_password(request, user_id):
    """Allow admin to reset any user's password"""
    admin_user = request.user
    
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')
    
    if not new_password or not confirm_password:
        return Response(
            {'error': 'New password and confirmation are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if new_password != confirm_password:
        return Response(
            {'error': 'Passwords do not match'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if admin_user.id == target_user.id:
        return Response(
            {'error': 'Use the change password endpoint to change your own password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    target_user.set_password(new_password)
    target_user.save()
    
    logger.info(f"Password reset by admin {admin_user.username} for user: {target_user.username}")
    
    return Response({'message': f'Password reset successfully for user {target_user.username}'}, status=status.HTTP_200_OK)
