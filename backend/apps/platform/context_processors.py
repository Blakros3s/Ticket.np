from apps.platform.tenant_context import get_active_tenants, get_selected_tenant


def platform_admin_context(request):
    if not request.path.startswith('/admin/'):
        return {}

    return {
        'platform_admin_tenant': get_selected_tenant(request),
        'platform_tenants': get_active_tenants(),
    }
