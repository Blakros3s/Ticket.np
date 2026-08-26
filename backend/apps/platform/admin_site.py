from django.contrib.admin import AdminSite


class PlatformAdminSite(AdminSite):
    site_header = 'TicketHub Platform Administration'
    site_title = 'Platform Admin'
    index_title = 'Platform management'
    # Public schema has no django_admin_log (admin app is tenant-only).
    index_template = 'admin/platform_index.html'


platform_admin_site = PlatformAdminSite(name='platform_admin')
