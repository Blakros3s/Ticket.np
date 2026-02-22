from django.urls import path
from .views import employee_dashboard, manager_dashboard, admin_dashboard, employee_reports, manager_reports, admin_reports

urlpatterns = [
    path('employee/', employee_dashboard, name='employee_dashboard'),
    path('manager/', manager_dashboard, name='manager_dashboard'),
    path('admin/', admin_dashboard, name='admin_dashboard'),
    path('reports/employee/', employee_reports, name='employee_reports'),
    path('reports/manager/', manager_reports, name='manager_reports'),
    path('reports/admin/', admin_reports, name='admin_reports'),
]
