from django.contrib import admin

from apps.platform.admin_site import platform_admin_site

from .models import PlatformUser


class PlatformUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_active', 'created_at')
    search_fields = ('username', 'email')


platform_admin_site.register(PlatformUser, PlatformUserAdmin)
