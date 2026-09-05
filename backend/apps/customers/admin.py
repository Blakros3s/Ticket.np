from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from apps.platform.admin_site import platform_admin_site

from .models import Client, Domain, Plan, TenantLoginAccount, TenantSubscription


class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'schema_name', 'slug', 'is_active', 'created_at', 'manage_tenant_data')
    list_filter = ('is_active',)
    search_fields = ('name', 'schema_name', 'slug')

    @admin.display(description='Tenant data')
    def manage_tenant_data(self, obj):
        url = f"{reverse('admin:index')}?tenant={obj.schema_name}"
        return format_html('<a href="{}">Manage data</a>', url)


class DomainAdmin(admin.ModelAdmin):
    list_display = ('domain', 'tenant', 'is_primary')
    search_fields = ('domain',)


class PlanAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'tier',
        'monthly_price',
        'max_users',
        'max_projects',
        'attendance_enabled',
        'calendar_enabled',
    )


class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('client', 'plan', 'status', 'expires_at', 'started_at')
    list_filter = ('status', 'plan')


class TenantLoginAccountAdmin(admin.ModelAdmin):
    list_display = ('username', 'client', 'tenant_user_id')
    list_filter = ('client',)
    search_fields = ('username', 'client__name', 'client__schema_name')
    readonly_fields = ('client', 'username', 'tenant_user_id')


platform_admin_site.register(Client, ClientAdmin)
platform_admin_site.register(Domain, DomainAdmin)
platform_admin_site.register(Plan, PlanAdmin)
platform_admin_site.register(TenantSubscription, TenantSubscriptionAdmin)
platform_admin_site.register(TenantLoginAccount, TenantLoginAccountAdmin)
