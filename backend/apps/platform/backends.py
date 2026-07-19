from django.contrib.auth.backends import ModelBackend
from django_tenants.utils import get_public_schema_name, schema_context

from apps.platform.models import PlatformUser


class PlatformAdminBackend:
    """Authenticate platform admins against PlatformUser in the public schema."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or password is None:
            return None

        with schema_context(get_public_schema_name()):
            try:
                user = PlatformUser.objects.get(username=username)
            except PlatformUser.DoesNotExist:
                return None

            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        return None

    @staticmethod
    def user_can_authenticate(user):
        return getattr(user, 'is_active', True)

    def get_user(self, user_id):
        with schema_context(get_public_schema_name()):
            try:
                user = PlatformUser.objects.get(pk=user_id)
            except PlatformUser.DoesNotExist:
                return None
        return user if self.user_can_authenticate(user) else None


class TenantAwareModelBackend(ModelBackend):
    """Tenant User auth — skip public schema where the users table does not exist."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        from django.db import connection

        if connection.schema_name == get_public_schema_name():
            return None
        return super().authenticate(request, username=username, password=password, **kwargs)

    def get_user(self, user_id):
        from django.db import connection

        if connection.schema_name == get_public_schema_name():
            return None
        return super().get_user(user_id)
