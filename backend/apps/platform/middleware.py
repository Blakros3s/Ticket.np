from apps.customers.tenant_resolution import set_public_schema, set_tenant
from apps.platform.tenant_context import get_selected_tenant


class PlatformAdminSchemaMiddleware:
    """Activate the selected tenant schema for platform admin after sessions load."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/'):
            tenant = get_selected_tenant(request)
            if tenant is not None:
                set_tenant(tenant)
            else:
                set_public_schema()

        return self.get_response(request)
