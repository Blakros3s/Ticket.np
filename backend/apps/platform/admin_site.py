from django.contrib.admin import AdminSite


class PlatformAdminSite(AdminSite):
    site_header = 'TicketHub Platform Administration'
    site_title = 'Platform Admin'
    index_title = 'Platform management'


platform_admin_site = PlatformAdminSite(name='platform_admin')
