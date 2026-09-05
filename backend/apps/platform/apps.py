from django.apps import AppConfig


class PlatformConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.platform'
    label = 'platform'
    verbose_name = 'Platform Administration'

    def ready(self):
        from apps.platform.tenant_registry import register_tenant_admins

        register_tenant_admins()
