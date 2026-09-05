from apps.platform.tenant_context import get_active_tenants, get_selected_tenant


def platform_admin_context(request):
    if not request.path.startswith('/admin/'):
        return {}

    tenant = get_selected_tenant(request)
    return {
        'platform_admin_tenant': tenant,
        'platform_tenants': get_active_tenants(),
        'platform_admin_mode': 'tenant' if tenant else 'platform',
    }
