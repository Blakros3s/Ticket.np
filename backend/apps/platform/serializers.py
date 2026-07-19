from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import BlacklistMixin, RefreshToken

from apps.platform.models import PlatformUser


class PlatformRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user):
        # Skip BlacklistMixin.for_user — OutstandingToken.user must be AUTH_USER_MODEL.
        token = super(BlacklistMixin, cls).for_user(user)
        token['auth_type'] = 'platform'
        token['role'] = PlatformUser.ROLE
        token['username'] = user.username
        return token

    def check_blacklist(self):
        # Platform tokens are not stored in token_blacklist tables.
        return


class PlatformUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(read_only=True, default=PlatformUser.ROLE)

    class Meta:
        model = PlatformUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active']
        read_only_fields = fields


class PlatformTokenObtainPairSerializer(TokenObtainPairSerializer):
    token_class = PlatformRefreshToken
    username_field = PlatformUser.USERNAME_FIELD

    @classmethod
    def get_token(cls, user):
        return PlatformRefreshToken.for_user(user)

    def validate(self, attrs):
        username = attrs[self.username_field]
        password = attrs['password']

        try:
            user = PlatformUser.objects.get(username=username)
        except PlatformUser.DoesNotExist:
            raise serializers.ValidationError(
                {'detail': 'Invalid username or password.'},
                code='authorization',
            )

        if not user.check_password(password):
            raise serializers.ValidationError(
                {'detail': 'Invalid username or password.'},
                code='authorization',
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {'detail': 'Your account is inactive.'},
                code='authorization',
            )

        self.user = user
        refresh = self.get_token(user)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': PlatformUserSerializer(user).data,
        }


class PlatformTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = PlatformRefreshToken

    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])
        if refresh.get('auth_type') != 'platform':
            raise serializers.ValidationError('Token is not a platform refresh token.')

        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        try:
            user = PlatformUser.objects.get(pk=user_id)
        except (PlatformUser.DoesNotExist, TypeError, ValueError):
            raise AuthenticationFailed('User not found.', code='user_not_found') from None

        if not user.is_active:
            raise AuthenticationFailed('User is inactive.', code='user_inactive')

        data = {'access': str(refresh.access_token)}

        if api_settings.ROTATE_REFRESH_TOKENS:
            data['refresh'] = str(self.token_class.for_user(user))

        return data
