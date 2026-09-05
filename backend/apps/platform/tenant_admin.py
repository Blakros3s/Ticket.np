from __future__ import annotations

from django.contrib import admin
from django.shortcuts import render
from django_tenants.utils import schema_context

from apps.platform.tenant_context import get_active_tenants, get_selected_tenant


class TenantSchemaModelAdminMixin:
    """Run tenant model admin views inside the selected tenant PostgreSQL schema."""

    show_full_result_count = False

    def _merge_admin_context(self, request, extra_context=None):
        context = dict(extra_context or {})
        context['platform_admin_tenant'] = get_selected_tenant(request)
        context['platform_tenants'] = get_active_tenants()
        return context

    def _call_parent_permission(self, request, method_name, default=False, obj=None):
        tenant = get_selected_tenant(request)
        if tenant is None:
            return default
        with schema_context(tenant.schema_name):
            parent_method = getattr(super(), method_name)
            if obj is not None:
                return parent_method(request, obj)
            return parent_method(request)

    def has_view_permission(self, request, obj=None):
        return self._call_parent_permission(request, 'has_view_permission', obj=obj)

    def has_add_permission(self, request):
        return self._call_parent_permission(request, 'has_add_permission')

    def has_change_permission(self, request, obj=None):
        return self._call_parent_permission(request, 'has_change_permission', obj=obj)

    def has_delete_permission(self, request, obj=None):
        return self._call_parent_permission(request, 'has_delete_permission', obj=obj)

    def has_module_permission(self, request):
        if not request.user.is_active or not request.user.is_staff:
            return False
        tenant = get_selected_tenant(request)
        if tenant is None:
            # Keep tenant apps visible on the index without querying tenant tables.
            return True
        with schema_context(tenant.schema_name):
            return super().has_module_permission(request)

    def _render_tenant_required(self, request, extra_context=None):
        context = self._merge_admin_context(request, extra_context)
        context.update({
            'title': 'Select a tenant',
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        })
        return render(request, 'admin/select_tenant.html', context)

    def _run_in_tenant_schema(self, request, view, *args, **kwargs):
        tenant = get_selected_tenant(request)
        if tenant is None:
            return self._render_tenant_required(request, kwargs.get('extra_context'))

        kwargs['extra_context'] = self._merge_admin_context(request, kwargs.get('extra_context'))

        with schema_context(tenant.schema_name):
            return view(request, *args, **kwargs)

    def changelist_view(self, request, extra_context=None):
        return self._run_in_tenant_schema(
            request,
            super().changelist_view,
            extra_context=extra_context,
        )

    def add_view(self, request, form_url='', extra_context=None):
        return self._run_in_tenant_schema(
            request,
            super().add_view,
            form_url=form_url,
            extra_context=extra_context,
        )

    def change_view(self, request, object_id, form_url='', extra_context=None):
        return self._run_in_tenant_schema(
            request,
            super().change_view,
            object_id,
            form_url=form_url,
            extra_context=extra_context,
        )

    def delete_view(self, request, object_id, extra_context=None):
        return self._run_in_tenant_schema(
            request,
            super().delete_view,
            object_id,
            extra_context=extra_context,
        )

    def history_view(self, request, object_id, extra_context=None):
        return self._run_in_tenant_schema(
            request,
            super().history_view,
            object_id,
            extra_context=extra_context,
        )

    def autocomplete_view(self, request):
        return self._run_in_tenant_schema(request, super().autocomplete_view)


class TenantSchemaModelAdmin(TenantSchemaModelAdminMixin, admin.ModelAdmin):
    pass
