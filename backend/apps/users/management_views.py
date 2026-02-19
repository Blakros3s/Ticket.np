import logging
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.core.exceptions import PermissionDenied
from .models import User, UserRole
from .serializers import UserSerializer, RegisterSerializer, CustomTokenObtainPairSerializer, AdminUserCreateSerializer, UserRoleSerializer
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

    def post(self, request, *args, **kwargs):
        # Admin creation of a new user with a specific role
        serializer = AdminUserCreateSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            logger.warning(f"Admin user creation failed: {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating user via admin: {str(e)}")
            return Response({'detail': 'Failed to create user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


@extend_schema_view(
    get=extend_schema(
        summary="List department roles",
        description="Retrieve list of all available department roles (Frontend, Backend, DevOps, etc.)"
    ),
    post=extend_schema(
        summary="Create department role",
        description="Create a new department role (Admin only)"
    )
)
class UserRoleListView(generics.ListCreateAPIView):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error listing department roles: {str(e)}")
            return Response({'detail': 'Failed to retrieve department roles'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create(self, request, *args, **kwargs):
        try:
            logger.info(f"Creating new department role by {request.user.username}")
            logger.info(f"Request data: {request.data}")
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            role = serializer.save()
            logger.info(f"Department role created successfully: {role.name}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            logger.warning(f"Department role creation failed: {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating department role: {str(e)}")
            return Response({'detail': 'Failed to create department role'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema_view(
    get=extend_schema(
        summary="Get department role details",
        description="Retrieve details of a specific department role"
    ),
    put=extend_schema(
        summary="Update department role",
        description="Update an existing department role (Admin only)"
    ),
    patch=extend_schema(
        summary="Partial update department role",
        description="Partially update a department role (Admin only)"
    ),
    delete=extend_schema(
        summary="Delete department role",
        description="Delete a department role (Admin only)"
    )
)
class UserRoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    lookup_field = 'pk'

    def get_object(self):
        return UserRole.objects.get(id=self.kwargs.get('pk'))

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Updating department role {self.kwargs.get('pk')} by {request.user.username}")
            return super().update(request, *args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Department role update failed: {str(e)}")
            error_detail = e.detail if hasattr(e, 'detail') else {'detail': str(e)}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating department role: {str(e)}")
            return Response({'detail': 'Failed to update department role'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        try:
            logger.info(f"Deleting department role {self.kwargs.get('pk')} by {request.user.username}")
            return super().destroy(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error deleting department role: {str(e)}")
            return Response({'detail': 'Failed to delete department role'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
