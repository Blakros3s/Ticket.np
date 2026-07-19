from django.db import connection
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class TenantJWTAuthentication(JWTAuthentication):
    """
    Reject tenant tokens on the wrong schema and reject platform tokens on tenant hosts.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result

        if validated_token.get('auth_type') == 'platform':
            raise InvalidToken('Platform token cannot be used on tenant routes.')

        token_schema = validated_token.get('tenant_schema')
        current_schema = getattr(connection, 'schema_name', None)
        if token_schema and current_schema and token_schema != current_schema:
            raise InvalidToken('Token tenant does not match request tenant.')

        return user, validated_token

    def get_user(self, validated_token):
        if validated_token.get('auth_type') == 'platform':
            raise InvalidToken('Platform token cannot be used on tenant routes.')
        return super().get_user(validated_token)
