from rest_framework.permissions import BasePermission


class IsServerAdmin(BasePermission):
    """Grants access to platform server admin users only."""

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'role', None) == 'server_admin'
        )
