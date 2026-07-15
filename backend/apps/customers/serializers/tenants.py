from rest_framework import serializers

from apps.customers.models import Client


class ClientCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    slug = serializers.CharField(max_length=64)
    login_domain = serializers.CharField(max_length=120, required=False, allow_blank=True)
    domain = serializers.CharField(max_length=253, required=False, allow_blank=True)
    admin_username = serializers.CharField(max_length=150)
    admin_password = serializers.CharField(max_length=128, write_only=True)
    admin_email = serializers.EmailField(required=False, allow_blank=True, default='')
    admin_first_name = serializers.CharField(required=False, allow_blank=True, default='')
    admin_last_name = serializers.CharField(required=False, allow_blank=True, default='')
    plan_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_login_domain(self, value: str) -> str:
        from apps.customers.services.login_accounts import normalize_login_domain

        if not (value or '').strip():
            return ''
        return normalize_login_domain(value)


class ClientUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['name', 'is_active', 'login_domain']

    def validate_login_domain(self, value: str) -> str:
        from apps.customers.services.login_accounts import assert_login_domain_available, normalize_login_domain
        from apps.customers.services.tenants import TenantProvisionError

        normalized = normalize_login_domain(value)
        instance = getattr(self, 'instance', None)
        exclude_id = instance.pk if instance is not None else None
        try:
            assert_login_domain_available(login_domain=normalized, exclude_client_id=exclude_id)
        except TenantProvisionError as exc:
            raise serializers.ValidationError(exc.message) from exc
        return normalized


class ClientListSerializer(serializers.ModelSerializer):
    primary_domain = serializers.SerializerMethodField()
    user_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'slug',
            'schema_name',
            'login_domain',
            'is_active',
            'primary_domain',
            'user_count',
            'created_at',
            'updated_at',
        ]

    def get_primary_domain(self, obj: Client) -> str | None:
        domain = obj.domains.filter(is_primary=True).first()
        return domain.domain if domain else None


class ClientDetailSerializer(ClientListSerializer):
    domains = serializers.SerializerMethodField()

    class Meta(ClientListSerializer.Meta):
        fields = ClientListSerializer.Meta.fields + ['domains']

    def get_domains(self, obj: Client) -> list[dict]:
        return [
            {'id': d.id, 'domain': d.domain, 'is_primary': d.is_primary}
            for d in obj.domains.all()
        ]


class DeleteClientSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    slug = serializers.CharField()

    def validate_slug(self, value):
        tenant = self.context.get('client')
        normalized = (value or '').strip().lower()
        if tenant and normalized != tenant.slug.strip().lower():
            raise serializers.ValidationError('Slug confirmation does not match.')
        return normalized


class TenantUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    role = serializers.CharField()
    is_active = serializers.BooleanField()


class TenantUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    role = serializers.ChoiceField(choices=['admin', 'manager', 'employee'], default='employee')
