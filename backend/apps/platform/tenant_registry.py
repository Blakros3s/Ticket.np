from apps.activity.admin import ActivityLogAdmin
from apps.activity.models import ActivityLog
from apps.attendance.admin import (
    AttendanceAdmin,
    AttendanceLogAdmin,
    LeaveRequestAdmin,
    OfficeSettingsAdmin,
)
from apps.attendance.models import Attendance, AttendanceLog, LeaveRequest, OfficeSettings
from apps.comments.admin import CommentAdmin
from apps.comments.models import Comment
from apps.payroll.admin import PayrollEmployeeAdmin, SalaryPaymentAdmin
from apps.payroll.models import PayrollEmployee, SalaryPayment
from apps.platform.admin_site import platform_admin_site
from apps.platform.tenant_admin import TenantSchemaModelAdmin
from apps.projects.admin import ProjectAdmin, ProjectMemberAdmin
from apps.projects.models import Project, ProjectMember
from apps.tickets.admin import TicketAdmin
from apps.tickets.models import Ticket
from apps.timelogs.admin import WorkLogAdmin
from apps.timelogs.models import WorkLog
from apps.todos.admin import TodoItemAdmin
from apps.todos.models import TodoItem
from apps.users.admin import UserAdmin, UserRoleAdmin
from apps.users.models import User, UserRole


def _tenant_admin(base_admin):
    name = f'PlatformTenant{base_admin.__name__}'
    return type(name, (TenantSchemaModelAdmin, base_admin), {})


def register_tenant_admins() -> None:
    registrations = [
        (User, UserAdmin),
        (UserRole, UserRoleAdmin),
        (Project, ProjectAdmin),
        (ProjectMember, ProjectMemberAdmin),
        (Ticket, TicketAdmin),
        (Comment, CommentAdmin),
        (WorkLog, WorkLogAdmin),
        (ActivityLog, ActivityLogAdmin),
        (TodoItem, TodoItemAdmin),
        (OfficeSettings, OfficeSettingsAdmin),
        (LeaveRequest, LeaveRequestAdmin),
        (Attendance, AttendanceAdmin),
        (AttendanceLog, AttendanceLogAdmin),
        (PayrollEmployee, PayrollEmployeeAdmin),
        (SalaryPayment, SalaryPaymentAdmin),
    ]

    for model, admin_class in registrations:
        if model in platform_admin_site._registry:
            continue
        platform_admin_site.register(model, _tenant_admin(admin_class))
