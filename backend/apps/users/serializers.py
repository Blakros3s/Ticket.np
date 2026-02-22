from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, UserRole


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'display_name', 'color']


class UserSerializer(serializers.ModelSerializer):
    department_roles = UserRoleSerializer(many=True, read_only=True)
    department_role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=UserRole.objects.all(), source='department_roles', write_only=True, required=False
    )
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'department_roles', 'department_role_ids', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def update(self, instance, validated_data):
        department_roles = validated_data.pop('department_roles', None)
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update department roles if provided
        if department_roles is not None:
            instance.department_roles.set(department_roles)
        
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


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        token['username'] = user.username
        token['role'] = user.role
        token['email'] = user.email
        
        return token
    
    def validate(self, attrs):
        from django.contrib.auth import authenticate
        
        authenticate_kwargs = {
            self.username_field: attrs[self.username_field],
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
                code='authorization'
            )
        
        if not self.user.is_active:
            raise serializers.ValidationError(
                {'detail': 'Your account is inactive. Please contact your administrator.'},
                code='authorization'
            )

        data = {}
        refresh = self.get_token(self.user)

        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        data['user'] = UserSerializer(self.user).data

        return data

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
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        department_roles = validated_data.pop('department_roles', [])
        # role may be provided; default to 'employee' if not
        role = validated_data.get('role', 'employee')
        user = User.objects.create(**validated_data)
        user.role = role
        user.set_password(password)
        user.save()
        # Add department roles
        if department_roles:
            user.department_roles.set(department_roles)
        return user
