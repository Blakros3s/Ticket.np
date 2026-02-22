from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, UserRole


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'display_name', 'color']
    list_filter = ['name']
    search_fields = ['name', 'display_name']


class CustomUserAdmin(BaseUserAdmin):
    """Admin interface for the custom User model.

    This provides a clear "User Management" section in the admin with
    add/edit/view capabilities for all user roles (admin, manager, employee).
    It reuses Django's built-in UserAdmin protections (password handling,
    permissions) while exposing the custom `role` field.
    """

    # Fieldsets for editing an existing user
    fieldsets = (
        (None, {
            'fields': ('username', 'password')
        }),
        (_('Personal info'), {
            'fields': ('first_name', 'last_name', 'email')
        }),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        (_('Dates'), {
            'fields': ('last_login', 'date_joined')
        }),
        (_('Role'), {
            'fields': ('role', 'department_roles')
        }),
    )

    # Fieldsets used when adding a new user
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'role', 'password1', 'password2'),
        }),
    )

    list_display = ['username', 'email', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'department_roles', 'date_joined']
    search_fields = ['username', 'email']
    ordering = ['-date_joined']
    filter_horizontal = ['department_roles']

    # Ensure the admin explicitly handles the role field in a user-friendly way
    def get_readonly_fields(self, request, obj=None):
        # Don't lock down role editing in the default edit view
        ro = super().get_readonly_fields(request, obj)
        return ro


@admin.register(User)
class UserAdmin(CustomUserAdmin):
    pass
