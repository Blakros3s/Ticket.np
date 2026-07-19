from django.contrib.auth import authenticate
from django_tenants.utils import schema_context
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.tenant_resolution import resolve_tenant, set_tenant
from apps.customers.services.login_accounts import resolve_login_account
from apps.customers.services.plans import get_subscription_display, sync_subscription_status
from .models import User, UserRole


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'display_name', 'color']


class UserSerializer(serializers.ModelSerializer):
    """Read-only user representation for lists and auth responses."""
    department_roles = UserRoleSerializer(many=True, read_only=True)
    department_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=UserRole.objects.all(), source='department_roles', write_only=True, required=False
    )
    login_address = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'department_role_ids', 'login_address', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'login_address', 'is_active', 'created_at', 'updated_at']

    def get_login_address(self, obj: User) -> str | None:
        from apps.customers.services.login_accounts import login_address_for_user

        return login_address_for_user(user=obj)


class UserProfileSerializer(serializers.ModelSerializer):
    """Profile updates — sensitive fields cannot be self-modified."""
    department_roles = UserRoleSerializer(many=True, read_only=True)
    department_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=UserRole.objects.all(), source='department_roles', write_only=True, required=False
    )
    login_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'department_role_ids', 'login_address', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'username', 'role', 'login_address', 'is_active', 'created_at', 'updated_at']

    def get_login_address(self, obj: User) -> str | None:
        from apps.customers.services.login_accounts import login_address_for_user

        return login_address_for_user(user=obj)

    def update(self, instance, validated_data):
        department_roles = validated_data.pop('department_roles', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if department_roles is not None:
            instance.department_roles.set(department_roles)

        return instance


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin-only user updates including role and active status."""
    department_roles = UserRoleSerializer(many=True, read_only=True)
    department_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=UserRole.objects.all(), source='department_roles', write_only=True, required=False
    )
    login_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'department_role_ids', 'login_address', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'login_address']

    def get_login_address(self, obj: User) -> str | None:
        from apps.customers.services.login_accounts import login_address_for_user

        return login_address_for_user(user=obj)

    def validate_username(self, value: str) -> str:
        from django.db import connection

        instance = getattr(self, 'instance', None)
        tenant = getattr(connection, 'tenant', None)
        if instance is None or tenant is None or value == instance.username:
            return value

        from apps.customers.services.login_accounts import build_login_identifier, resolve_login_account

        login_id = build_login_identifier(
            local_username=value,
            login_domain=tenant.login_domain,
        )
        existing = resolve_login_account(login_id)
        if existing is not None and existing.tenant_user_id != instance.pk:
            raise serializers.ValidationError('Login address already taken on the platform.')
        return value

    def update(self, instance, validated_data):
        from django.db import connection

        from apps.customers.services.login_accounts import sync_login_account_username
        from apps.customers.services.tenants import TenantProvisionError

        previous_username = instance.username
        department_roles = validated_data.pop('department_roles', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if department_roles is not None:
            instance.department_roles.set(department_roles)

        tenant = getattr(connection, 'tenant', None)
        if tenant is not None and instance.username != previous_username:
            try:
                sync_login_account_username(
                    client=tenant,
                    user=instance,
                    previous_username=previous_username,
                )
            except TenantProvisionError as exc:
                instance.username = previous_username
                instance.save(update_fields=['username'])
                raise serializers.ValidationError({'username': exc.message}) from exc
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'confirm_password']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class TenantRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user):
        from django.db import connection

        token = super().for_user(user)
        tenant = getattr(connection, 'tenant', None)
        token['auth_type'] = 'tenant'
        token['username'] = user.username
        token['role'] = user.role
        token['email'] = user.email
        token['tenant_schema'] = getattr(connection, 'schema_name', '')
        token['tenant_slug'] = getattr(tenant, 'slug', '')
        token['tenant_name'] = getattr(tenant, 'name', '')
        return token


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    token_class = TenantRefreshToken

    @classmethod
    def get_token(cls, user):
        return TenantRefreshToken.for_user(user)

    def validate(self, attrs):
        raw_username = attrs.get(self.username_field)
        if isinstance(raw_username, str):
            attrs[self.username_field] = raw_username.strip()
        password = attrs.get('password')
        if isinstance(password, str):
            attrs['password'] = password.strip()

        login_account = resolve_login_account(attrs[self.username_field])
        if login_account is None:
            raise serializers.ValidationError(
                {'detail': 'Invalid username or password. Please check your credentials and try again.'},
                code='authorization',
            )

        client = login_account.client

        if not client.is_active:
            raise serializers.ValidationError(
                {'detail': 'This organization is inactive. Please contact support.'},
                code='authorization',
            )

        sync_subscription_status(client)
        subscription = get_subscription_display(client)
        if subscription is None or subscription.is_effectively_expired:
            raise serializers.ValidationError(
                {'detail': 'Your subscription has expired. Please contact support to renew.'},
                code='authorization',
            )

        with schema_context(client.schema_name):
            set_tenant(client)
            try:
                tenant_user = User.objects.get(pk=login_account.tenant_user_id)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    {'detail': 'Invalid username or password. Please check your credentials and try again.'},
                    code='authorization',
                )

            authenticate_kwargs = {
                self.username_field: tenant_user.username,
                'password': attrs['password'],
            }
            try:
                authenticate_kwargs['request'] = self.context['request']
            except KeyError:
                pass

            self.user = authenticate(**authenticate_kwargs)

            if not self.user:
                raise serializers.ValidationError(
                    {'detail': 'Invalid username or password. Please check your credentials and try again.'},
                    code='authorization',
                )

            if self.user.pk != login_account.tenant_user_id:
                raise serializers.ValidationError(
                    {'detail': 'Invalid username or password. Please check your credentials and try again.'},
                    code='authorization',
                )

            if not self.user.is_active:
                raise serializers.ValidationError(
                    {'detail': 'Your account is inactive. Please contact your administrator.'},
                    code='authorization',
                )

            refresh = self.get_token(self.user)
            user_data = UserSerializer(self.user).data

        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': user_data,
            'tenant': {
                'slug': client.slug,
                'schema_name': client.schema_name,
                'name': client.name,
            },
        }
        return data


class TenantTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs['refresh'])
        schema = refresh.get('tenant_schema')
        if not schema:
            raise serializers.ValidationError('Invalid refresh token.')

        client = resolve_tenant(schema)
        if client is None:
            raise serializers.ValidationError('Organization not found.')

        with schema_context(client.schema_name):
            set_tenant(client)
            return super().validate(attrs)


class TenantOrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(read_only=True)
    slug = serializers.CharField(read_only=True)
    login_domain = serializers.CharField(max_length=120)

    def validate_login_domain(self, value: str) -> str:
        from django.db import connection

        from apps.customers.services.login_accounts import assert_login_domain_available, normalize_login_domain
        from apps.customers.services.tenants import TenantProvisionError

        normalized = normalize_login_domain(value)
        tenant = getattr(connection, 'tenant', None)
        exclude_id = getattr(tenant, 'pk', None)
        try:
            assert_login_domain_available(login_domain=normalized, exclude_client_id=exclude_id)
        except TenantProvisionError as exc:
            raise serializers.ValidationError(exc.message) from exc
        return normalized


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Serializer to allow admins to create a user with a specific role and password."""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    department_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=UserRole.objects.all(), source='department_roles', write_only=True, required=False
    )
    department_roles = UserRoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'department_role_ids', 'password', 'confirm_password', 'is_active']
        read_only_fields = ['id', 'is_active']

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({'password': 'Password fields didn\'t match.'})

        username = attrs.get('username')
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if username and tenant is not None:
            from apps.customers.services.login_accounts import (
                build_login_identifier,
                resolve_login_account,
            )

            login_id = build_login_identifier(
                local_username=username,
                login_domain=tenant.login_domain,
            )
            if resolve_login_account(login_id):
                raise serializers.ValidationError(
                    {'username': 'Login address already taken on the platform.'},
                )
        return attrs

    def create(self, validated_data):
        from django.db import connection

        from apps.customers.services.login_accounts import register_login_account

        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        department_roles = validated_data.pop('department_roles', [])
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        if department_roles:
            user.department_roles.set(department_roles)

        tenant = getattr(connection, 'tenant', None)
        if tenant is not None:
            try:
                register_login_account(client=tenant, user=user)
            except Exception as exc:
                user.delete()
                from apps.customers.services.tenants import TenantProvisionError

                if isinstance(exc, TenantProvisionError):
                    raise serializers.ValidationError({'username': exc.message}) from exc
                raise
        return user
