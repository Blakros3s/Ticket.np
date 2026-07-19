from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from apps.platform.models import PlatformUser


class PlatformJWTAuthentication(JWTAuthentication):
    """JWT auth for platform users on public-schema routes."""

    def get_user(self, validated_token):
        if validated_token.get('auth_type') != 'platform':
            raise InvalidToken('Token is not a platform token.')

        try:
            user_id = validated_token['user_id']
        except KeyError as exc:
            raise InvalidToken('Token contained no recognizable user identification.') from exc

        try:
            user = PlatformUser.objects.get(pk=user_id)
        except PlatformUser.DoesNotExist as exc:
            raise AuthenticationFailed('User not found.', code='user_not_found') from exc

        if not user.is_active:
            raise AuthenticationFailed('User is inactive.', code='user_inactive')

        return user
