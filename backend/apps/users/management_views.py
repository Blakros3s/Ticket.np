from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User
from .serializers import UserSerializer
from .permissions import IsAdminUser


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
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        else:
            return User.objects.filter(is_active=True)


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
            user = User.objects.get(id=user_id)
            user.is_active = False
            user.save()
            return Response({'message': 'User deactivated successfully'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
