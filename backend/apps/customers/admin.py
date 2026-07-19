from django.contrib import admin

from apps.platform.admin_site import platform_admin_site

from .models import Client, Domain, Plan, TenantSubscription


class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'schema_name', 'slug', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'schema_name', 'slug')


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


platform_admin_site.register(Client, ClientAdmin)
platform_admin_site.register(Domain, DomainAdmin)
platform_admin_site.register(Plan, PlanAdmin)
platform_admin_site.register(TenantSubscription, TenantSubscriptionAdmin)
