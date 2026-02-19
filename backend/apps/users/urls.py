from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, CustomTokenObtainPairView, UserProfileView, UserDetailView
from .management_views import UserListView, DeactivateUserView, UserRoleListView, UserRoleDetailView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:user_id>/deactivate/', DeactivateUserView.as_view(), name='deactivate_user'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('department-roles/', UserRoleListView.as_view(), name='department_roles'),
    path('department-roles/<int:pk>/', UserRoleDetailView.as_view(), name='department_role_detail'),
]
