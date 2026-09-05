from django.contrib.admin import AdminSite

from apps.platform.tenant_context import get_selected_tenant


class PlatformAdminSite(AdminSite):
    site_header = 'TicketHub Platform Administration'
    site_title = 'Platform Admin'
    index_title = 'Platform management'
    # Public schema has no django_admin_log (admin app is tenant-only).
    index_template = 'admin/platform_index.html'

    def _is_tenant_scoped_admin(self, model_admin) -> bool:
        return getattr(model_admin, 'tenant_scoped', False)

    def _model_entry_matches(self, registered_model, model_entry: dict) -> bool:
        meta = registered_model._meta
        object_name = model_entry.get('object_name', '')
        return meta.object_name == object_name or meta.model_name == object_name.lower()

    def get_app_list(self, request, app_label=None):
        app_list = super().get_app_list(request, app_label)
        tenant_selected = get_selected_tenant(request) is not None

        filtered_apps = []
        for app in app_list:
            visible_models = []
            for model_entry in app['models']:
                model_admin = None
                for registered_model, registered_admin in self._registry.items():
                    if (
                        registered_model._meta.app_label == app['app_label']
                        and self._model_entry_matches(registered_model, model_entry)
                    ):
                        model_admin = registered_admin
                        break

                if model_admin is None:
                    continue

                is_tenant_scoped = self._is_tenant_scoped_admin(model_admin)
                if tenant_selected and is_tenant_scoped:
                    visible_models.append(model_entry)
                elif not tenant_selected and not is_tenant_scoped:
                    visible_models.append(model_entry)

            if visible_models:
                filtered_apps.append({**app, 'models': visible_models})

        return filtered_apps


platform_admin_site = PlatformAdminSite(name='platform_admin')
