from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Client, Plan
from apps.customers.serializers.plans import (
    AssignPlanSerializer,
    PlanSerializer,
    build_subscription_detail,
    build_subscription_summary,
)
from apps.customers.serializers.tenants import (
    ClientCreateSerializer,
    ClientDetailSerializer,
    ClientListSerializer,
    ClientUpdateSerializer,
    DeleteClientSerializer,
    TenantUserCreateSerializer,
    TenantUserSerializer,
)
from apps.customers.services.plans import assign_plan_to_client, get_client_plan_usage
from apps.customers.services.tenants import (
    TenantProvisionError,
    create_client_user,
    create_client_with_admin,
    deactivate_client,
    delete_client_permanently,
    list_client_users,
    reactivate_client,
    reset_client_user_password,
)
from apps.platform.authentication import PlatformJWTAuthentication
from apps.platform.permissions import IsServerAdmin


class ServerPlanViewSet(viewsets.ModelViewSet):
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsAuthenticated, IsServerAdmin]
    serializer_class = PlanSerializer
    queryset = Plan.objects.all().order_by('monthly_price')
    http_method_names = ['get', 'post', 'patch', 'head', 'options']


class ServerTenantViewSet(viewsets.ModelViewSet):
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsAuthenticated, IsServerAdmin]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return (
            Client.objects.select_related('subscription__plan')
            .prefetch_related('domains')
            .order_by('name')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return ClientCreateSerializer
        if self.action in {'partial_update', 'update'}:
            return ClientUpdateSerializer
        if self.action == 'retrieve':
            return ClientDetailSerializer
        return ClientListSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        payload = []
        for client in queryset:
            data = ClientListSerializer(client).data
            usage = get_client_plan_usage(client)
            data['user_count'] = usage.get('users', 0)
            data['subscription'] = build_subscription_summary(_subscription_for(client))
            payload.append(data)
        return Response(payload)

    def retrieve(self, request, *args, **kwargs):
        client = self.get_object()
        return Response(_client_detail_payload(client))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        plan = None
        plan_id = data.get('plan_id')
        if plan_id is not None:
            try:
                plan = Plan.objects.get(pk=plan_id)
            except Plan.DoesNotExist:
                return Response({'plan_id': ['Plan not found.']}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client, _admin = create_client_with_admin(
                name=data['name'],
                slug=data['slug'],
                domain=data.get('domain') or None,
                login_domain=data.get('login_domain') or None,
                admin_username=data['admin_username'],
                admin_password=data['admin_password'],
                admin_email=data.get('admin_email', ''),
                admin_first_name=data.get('admin_first_name', ''),
                admin_last_name=data.get('admin_last_name', ''),
                plan=plan,
            )
        except TenantProvisionError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)

        client = self.get_queryset().get(pk=client.pk)
        return Response(_client_detail_payload(client), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        from apps.customers.services.login_accounts import resync_client_login_accounts

        client = self.get_object()
        was_inactive = not client.is_active
        old_login_domain = client.login_domain
        serializer = ClientUpdateSerializer(client, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        client = serializer.save()
        if client.login_domain != old_login_domain:
            resync_client_login_accounts(client)

        if was_inactive and client.is_active:
            reactivate_client(client=client)
            client = self.get_queryset().get(pk=client.pk)

        return Response(_client_detail_payload(client))

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        deactivate_client(client=client)
        return Response({'detail': 'Tenant deactivated.'})

    @action(detail=True, methods=['post'], url_path='reactivate')
    def reactivate(self, request, pk=None):
        client = self.get_object()
        reactivate_client(client=client)
        client = self.get_queryset().get(pk=client.pk)
        return Response(_client_detail_payload(client))

    @action(detail=True, methods=['post'], url_path='purge')
    def purge(self, request, pk=None):
        client = self.get_object()
        serializer = DeleteClientSerializer(data=request.data, context={'client': client})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        platform_user = request.user
        if not hasattr(platform_user, 'check_password'):
            return Response({'detail': 'Invalid platform user.'}, status=status.HTTP_403_FORBIDDEN)

        password = serializer.validated_data['password']
        if not platform_user.check_password(password):
            return Response(
                {
                    'detail': 'Incorrect platform console password.',
                    'password': ['Incorrect platform console password.'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        slug = delete_client_permanently(client=client)
        return Response({'detail': f'Tenant "{slug}" and all data were permanently deleted.'})

    @action(detail=True, methods=['get', 'post'], url_path='users')
    def users(self, request, pk=None):
        client = self.get_object()
        if request.method == 'GET':
            users = list_client_users(client=client)
            payload = [
                {
                    'id': u.id,
                    'username': u.username,
                    'email': u.email,
                    'first_name': u.first_name,
                    'last_name': u.last_name,
                    'role': u.role,
                    'is_active': u.is_active,
                }
                for u in users
            ]
            return Response(payload)

        serializer = TenantUserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            user = create_client_user(
                client=client,
                username=data['username'],
                password=data['password'],
                role=data.get('role', 'employee'),
                email=data.get('email', ''),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
            )
        except TenantProvisionError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)

        return Response(
            TenantUserSerializer({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'is_active': user.is_active,
            }).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['post'],
        url_path=r'users/(?P<user_id>[^/.]+)/reset-password',
    )
    def reset_user_password(self, request, pk=None, user_id=None):
        client = self.get_object()
        password = request.data.get('password')
        if not password:
            return Response({'password': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reset_client_user_password(client=client, user_id=int(user_id), password=password)
        except TenantProvisionError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)

        return Response({'detail': 'Password reset successfully.'})

    @action(detail=True, methods=['post'], url_path='assign-plan')
    def assign_plan(self, request, pk=None):
        client = self.get_object()
        serializer = AssignPlanSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = Plan.objects.get(pk=serializer.validated_data['plan_id'])
        except Plan.DoesNotExist:
            return Response({'plan_id': ['Plan not found.']}, status=status.HTTP_400_BAD_REQUEST)

        assign_plan_to_client(
            client=client,
            plan=plan,
            expires_at=serializer.validated_data.get('expires_at'),
            notes=serializer.validated_data.get('notes', ''),
        )

        client = self.get_queryset().get(pk=client.pk)
        return Response(_client_detail_payload(client))


def _subscription_for(client: Client):
    try:
        return client.subscription
    except ObjectDoesNotExist:
        return None


def _client_detail_payload(client: Client) -> dict:
    data = ClientDetailSerializer(client).data
    sub = _subscription_for(client)
    if sub is None:
        data['subscription'] = None
    else:
        data['subscription'] = build_subscription_detail(
            sub,
            usage=get_client_plan_usage(client),
        )
    return data
