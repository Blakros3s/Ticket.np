import logging
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.core.exceptions import PermissionDenied
from .models import User
from .serializers import UserSerializer
from .permissions import IsAdminUser

logger = logging.getLogger(__name__)


@extend_schema_view(
    get=extend_schema(
        summary="List users",
        description="Retrieve list of users. Admin can see all users, others see only active users."
    )
)
class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        try:
            user = self.request.user
            logger.info(f"User list request by: {user.username} (role: {user.role})")
            if user.role == 'admin':
                return User.objects.all()
            else:
                return User.objects.filter(is_active=True)
        except Exception as e:
            logger.error(f"Error in UserListView.get_queryset: {str(e)}")
            raise

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error listing users: {str(e)}")
            return Response({'detail': 'Failed to retrieve users list'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema_view(
    get=extend_schema(summary="Get user profile"),
    put=extend_schema(summary="Update user profile"),
    patch=extend_schema(summary="Partially update user profile")
)
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


@extend_schema_view(
    get=extend_schema(summary="Deactivate user", description="Deactivate a user account. Admin only.")
)
class DeactivateUserView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            logger.info(f"Deactivate user request by {request.user.username} for user_id: {user_id}")
            user = User.objects.get(id=user_id)
            
            if user.id == request.user.id:
                logger.warning(f"User {request.user.username} attempted to deactivate themselves")
                return Response({'detail': 'You cannot deactivate your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.is_active = False
            user.save()
            logger.info(f"User {user.username} (ID: {user_id}) deactivated by {request.user.username}")
            return Response({'message': 'User deactivated successfully'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            logger.warning(f"Attempt to deactivate non-existent user_id: {user_id}")
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error deactivating user {user_id}: {str(e)}")
            return Response({'detail': 'Failed to deactivate user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
