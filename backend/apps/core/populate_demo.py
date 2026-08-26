"""
Canonical demo-data seeding for TicketHub.

Management command: ``python manage.py populate_demo``
Programmatic API: ``seed_existing_demo_tenant()`` + ``run_all_demo_scenarios()``
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context

from apps.activity.models import ActivityLog
from apps.calendar.models import CalendarEvent
from apps.comments.models import Comment
from apps.customers.models import Client, Domain
from apps.customers.services.login_accounts import (
    build_login_identifier,
    register_login_account,
    resync_client_login_accounts,
)
from apps.customers.services.plans import assign_plan_to_client, ensure_default_plans
from apps.customers.services.tenants import create_client_with_admin, delete_client_permanently
from apps.customers.tenant_resolution import internal_domain_for
from apps.notifications.models import Notification
from apps.platform.models import PlatformUser
from apps.projects.models import Project, ProjectMember
from apps.tickets.models import Ticket, TicketIdCounter
from apps.timelogs.models import WorkLog
from apps.todos.models import TodoItem
from apps.users.models import User

# ---------------------------------------------------------------------------
# Demo tenant identity
# ---------------------------------------------------------------------------

DEMO_TENANT_SLUG = 'technest-hub'
DEMO_TENANT_SCHEMA = 'technest_hub'
DEMO_TENANT_NAME = 'Technest Innovations (Demo)'
DEMO_LOGIN_DOMAIN = 'technest.com'
DEMO_ADMIN_USERNAME = 'admin'
DEFAULT_PASSWORD = 'technest2026'
PLATFORM_ADMIN_USERNAME = 'serveradmin'

# Schemas removed by ``populate_demo --flush`` (demo tenant only by default).
DEMO_FLUSH_SCHEMAS: tuple[str, ...] = (DEMO_TENANT_SCHEMA,)
# Optional legacy dev schemas — extend when migrating off old ``main`` seed tenant.
LEGACY_FLUSH_SCHEMAS: tuple[str, ...] = ()

DEFAULT_TENANT_SCHEMA_LEGACY = 'main'

DEMO_TENANT_PROFILE = {
    'name': DEMO_TENANT_NAME,
    'slug': DEMO_TENANT_SLUG,
    'schema_name': DEMO_TENANT_SCHEMA,
    'login_domain': DEMO_LOGIN_DOMAIN,
}

# ---------------------------------------------------------------------------
# Catalog data
# ---------------------------------------------------------------------------

TENANT_USER_CATALOG: tuple[dict, ...] = (
    {
        'key': 'admin',
        'username': 'admin',
        'email': 'admin@technest.com',
        'first_name': 'System',
        'last_name': 'Administrator',
        'role': 'admin',
    },
    {
        'key': 'manager_john',
        'username': 'john.smith',
        'email': 'john.smith@technest.com',
        'first_name': 'John',
        'last_name': 'Smith',
        'role': 'manager',
    },
    {
        'key': 'manager_sarah',
        'username': 'sarah.johnson',
        'email': 'sarah.johnson@technest.com',
        'first_name': 'Sarah',
        'last_name': 'Johnson',
        'role': 'manager',
    },
    {
        'key': 'manager_david',
        'username': 'david.williams',
        'email': 'david.williams@technest.com',
        'first_name': 'David',
        'last_name': 'Williams',
        'role': 'manager',
    },
    {
        'key': 'employee_mike',
        'username': 'mike.brown',
        'email': 'mike.brown@technest.com',
        'first_name': 'Mike',
        'last_name': 'Brown',
        'role': 'employee',
    },
    {
        'key': 'employee_emily',
        'username': 'emily.jones',
        'email': 'emily.jones@technest.com',
        'first_name': 'Emily',
        'last_name': 'Jones',
        'role': 'employee',
    },
    {
        'key': 'employee_robert',
        'username': 'robert.garcia',
        'email': 'robert.garcia@technest.com',
        'first_name': 'Robert',
        'last_name': 'Garcia',
        'role': 'employee',
    },
    {
        'key': 'employee_lisa',
        'username': 'lisa.miller',
        'email': 'lisa.miller@technest.com',
        'first_name': 'Lisa',
        'last_name': 'Miller',
        'role': 'employee',
    },
    {
        'key': 'employee_james',
        'username': 'james.davis',
        'email': 'james.davis@technest.com',
        'first_name': 'James',
        'last_name': 'Davis',
        'role': 'employee',
    },
    {
        'key': 'employee_maria',
        'username': 'maria.wilson',
        'email': 'maria.wilson@technest.com',
        'first_name': 'Maria',
        'last_name': 'Wilson',
        'role': 'employee',
    },
)

PROJECT_CATALOG: tuple[dict, ...] = (
    {
        'key': 'website',
        'name': 'Website Redesign',
        'description': 'Modern marketing site, design system, and CMS migration.',
        'status': 'active',
        'github_repo': 'technest-innovations/website',
    },
    {
        'key': 'mobile',
        'name': 'Mobile App Development',
        'description': 'Cross-platform mobile client for ticket and project workflows.',
        'status': 'active',
        'github_repo': 'technest-innovations/mobile-app',
    },
    {
        'key': 'api',
        'name': 'API Integration',
        'description': 'Partner API connectors, webhook reliability, and rate limiting.',
        'status': 'active',
        'github_repo': '',
    },
    {
        'key': 'analytics',
        'name': 'Analytics Dashboard',
        'description': 'Executive KPIs, ticket throughput, and team workload charts.',
        'status': 'active',
        'github_repo': '',
    },
    {
        'key': 'security',
        'name': 'Security Audit',
        'description': 'Pen-test remediation, SSO hardening, and audit logging.',
        'status': 'active',
        'github_repo': '',
    },
    {
        'key': 'legacy_portal',
        'name': 'Legacy Customer Portal',
        'description': 'Archived portal kept for reference and read-only support.',
        'status': 'archived',
        'github_repo': '',
    },
)

# Deterministic tickets that map to every board column / detail state.
TICKET_SCENARIO_CATALOG: tuple[dict, ...] = (
    {
        'key': 'status_new',
        'title': '[Demo] New ticket — unassigned backlog item',
        'status': 'new',
        'priority': 'medium',
        'type': 'task',
        'module': 'backlog',
        'assign': False,
    },
    {
        'key': 'status_in_progress',
        'title': '[Demo] In progress — active development',
        'status': 'in_progress',
        'priority': 'high',
        'type': 'bug',
        'module': 'authentication',
        'assign': True,
    },
    {
        'key': 'status_qa',
        'title': '[Demo] QA — ready for verification',
        'status': 'qa',
        'priority': 'medium',
        'type': 'feature',
        'module': 'reports',
        'assign': True,
    },
    {
        'key': 'status_closed',
        'title': '[Demo] Closed — shipped fix',
        'status': 'closed',
        'priority': 'low',
        'type': 'task',
        'module': 'notifications',
        'assign': True,
    },
    {
        'key': 'status_reopened',
        'title': '[Demo] Reopened — regression after release',
        'status': 'reopened',
        'priority': 'critical',
        'type': 'bug',
        'module': 'payments',
        'assign': True,
    },
    {
        'key': 'due_soon',
        'title': '[Demo] Due soon — SLA at risk',
        'status': 'in_progress',
        'priority': 'critical',
        'type': 'bug',
        'module': 'sla',
        'assign': True,
        'due_in_days': 2,
    },
)

BULK_TICKET_TITLES: tuple[str, ...] = (
    'Login page authentication fails',
    'Dashboard loading slow',
    'Add export to CSV functionality',
    'User profile photo upload',
    'Fix responsive layout issues',
    'Implement dark mode',
    'Password reset email not sending',
    'Search functionality not working',
    'Add filtering options',
    'Optimize database queries',
)

BULK_TICKET_DESCRIPTIONS: tuple[str, ...] = (
    'Users report authentication failures with valid credentials.',
    'Dashboard exceeds acceptable load time on large datasets.',
    'Export to CSV is required for monthly operations reporting.',
    'Profile photos need upload, crop, and validation support.',
    'Layout breaks on tablet breakpoints in landscape orientation.',
)

COMMENT_TEMPLATES: tuple[str, ...] = (
    'Started investigating this issue.',
    'Root cause identified in the service layer.',
    'Fix deployed to staging — please verify.',
    'Added regression tests for this path.',
    'Needs product sign-off before closing.',
)

WORK_LOG_NOTES: tuple[str, ...] = (
    'Investigation and triage.',
    'Implementation and local testing.',
    'Code review feedback addressed.',
    'QA verification and documentation.',
)

TODO_CATALOG: tuple[dict, ...] = (
    {'title': 'Review sprint board', 'priority': 'high', 'status': 'pending'},
    {'title': 'Prepare release notes', 'priority': 'medium', 'status': 'in_progress'},
    {'title': 'Follow up on customer feedback', 'priority': 'low', 'status': 'completed'},
)

CALENDAR_CATALOG: tuple[dict, ...] = (
    {'title': 'Sprint planning', 'category': 'meeting', 'offset_days': 3},
    {'title': 'Release freeze', 'category': 'deadline', 'offset_days': 10},
    {'title': 'Team offsite', 'category': 'holiday', 'offset_days': 21},
)


@dataclass
class TenantContext:
    client: Client
    users: dict[str, User]
    projects: dict[str, Project]
    tickets: dict[str, Ticket] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Flush + platform admin
# ---------------------------------------------------------------------------


def flush_demo_tenants(*, include_legacy: bool = False) -> list[str]:
    """Delete known demo tenant schema(s). Never wipes the whole database."""
    schemas = list(DEMO_FLUSH_SCHEMAS)
    if include_legacy:
        schemas.extend(LEGACY_FLUSH_SCHEMAS)

    removed: list[str] = []
    with schema_context(get_public_schema_name()):
        for schema_name in schemas:
            client = Client.objects.filter(schema_name=schema_name).first()
            if client is None:
                continue
            delete_client_permanently(client=client)
            removed.append(schema_name)
    return removed


def upsert_platform_admin(password: str) -> PlatformUser:
    with schema_context(get_public_schema_name()):
        admin, _ = PlatformUser.objects.update_or_create(
            username=PLATFORM_ADMIN_USERNAME,
            defaults={
                'email': 'serveradmin@technest.com',
                'first_name': 'Server',
                'last_name': 'Admin',
                'is_active': True,
            },
        )
        admin.set_password(password)
        admin.save(update_fields=['password'])
        return admin


# ---------------------------------------------------------------------------
# Foundation seeding (users, projects)
# ---------------------------------------------------------------------------


def _upsert_user(client: Client, spec: dict, password: str) -> User:
    user, _ = User.objects.update_or_create(
        username=spec['username'],
        defaults={
            'email': spec['email'],
            'first_name': spec['first_name'],
            'last_name': spec['last_name'],
            'role': spec['role'],
            'is_active': True,
        },
    )
    user.set_password(password)
    user.save()
    register_login_account(client=client, user=user)
    return user


def _upsert_project(spec: dict, created_by: User, member_users: Iterable[User]) -> Project:
    project, _ = Project.objects.update_or_create(
        name=spec['name'],
        defaults={
            'description': spec['description'],
            'status': spec['status'],
            'github_repo': spec.get('github_repo') or None,
            'created_by': created_by,
        },
    )
    for member in member_users:
        ProjectMember.objects.get_or_create(project=project, user=member)
    return project


def seed_existing_demo_tenant(
    client: Client,
    *,
    password: str,
    user_catalog: tuple[dict, ...] = TENANT_USER_CATALOG,
    project_catalog: tuple[dict, ...] = PROJECT_CATALOG,
) -> TenantContext:
    """Upsert staff and projects on an existing tenant schema."""
    users: dict[str, User] = {}
    for spec in user_catalog:
        users[spec['key']] = _upsert_user(client, spec, password)

    managers = [u for key, u in users.items() if key.startswith('manager_')]
    employees = [u for key, u in users.items() if key.startswith('employee_')]
    all_staff = managers + employees

    projects: dict[str, Project] = {}
    for index, spec in enumerate(project_catalog):
        creator = managers[index % len(managers)]
        projects[spec['key']] = _upsert_project(spec, creator, all_staff)

    return TenantContext(client=client, users=users, projects=projects)


def seed_users_only(client: Client, *, password: str) -> dict[str, User]:
    users: dict[str, User] = {}
    for spec in TENANT_USER_CATALOG:
        users[spec['key']] = _upsert_user(client, spec, password)
    return users


def seed_projects_only(
    client: Client,
    *,
    password: str,
    users: dict[str, User] | None = None,
) -> dict[str, Project]:
    if users is None:
        users = seed_users_only(client, password=password)

    managers = [u for key, u in users.items() if key.startswith('manager_')]
    employees = [u for key, u in users.items() if key.startswith('employee_')]
    all_staff = managers + employees

    projects: dict[str, Project] = {}
    for index, spec in enumerate(PROJECT_CATALOG):
        creator = managers[index % len(managers)]
        projects[spec['key']] = _upsert_project(spec, creator, all_staff)
    return projects


def ensure_demo_tenant(*, password: str, plan) -> Client:
    with schema_context(get_public_schema_name()):
        client = Client.objects.filter(schema_name=DEMO_TENANT_SCHEMA).first()
        if client is None:
            client, _ = create_client_with_admin(
                name=DEMO_TENANT_NAME,
                slug=DEMO_TENANT_SLUG,
                schema_name=DEMO_TENANT_SCHEMA,
                domain=internal_domain_for(DEMO_TENANT_SCHEMA),
                login_domain=DEMO_LOGIN_DOMAIN,
                admin_username=DEMO_ADMIN_USERNAME,
                admin_password=password,
                admin_email='admin@technest.com',
                admin_first_name='System',
                admin_last_name='Administrator',
                plan=plan,
            )
            return client

        if client.login_domain != DEMO_LOGIN_DOMAIN:
            client.login_domain = DEMO_LOGIN_DOMAIN
            client.save(update_fields=['login_domain', 'updated_at'])

        Domain.objects.get_or_create(
            domain=internal_domain_for(DEMO_TENANT_SCHEMA),
            tenant=client,
            defaults={'is_primary': True},
        )
        assign_plan_to_client(client=client, plan=plan)
        return client


# ---------------------------------------------------------------------------
# Scenario seeding
# ---------------------------------------------------------------------------


def _apply_status_timestamps(ticket: Ticket, status: str, now) -> None:
    ticket.status = status
    if status == 'in_progress':
        ticket.in_progress_at = now - timedelta(hours=4)
    elif status == 'qa':
        ticket.in_progress_at = now - timedelta(days=1)
        ticket.qa_at = now - timedelta(hours=2)
    elif status == 'closed':
        ticket.in_progress_at = now - timedelta(days=3)
        ticket.qa_at = now - timedelta(days=2)
        ticket.closed_at = now - timedelta(days=1)
    elif status == 'reopened':
        ticket.in_progress_at = now - timedelta(days=5)
        ticket.qa_at = now - timedelta(days=4)
        ticket.closed_at = now - timedelta(days=3)
    ticket.save(
        update_fields=['status', 'in_progress_at', 'qa_at', 'closed_at', 'updated_at'],
    )


def _upsert_scenario_ticket(
    ctx: TenantContext,
    spec: dict,
    project: Project,
    creator: User,
    assignee: User | None,
) -> Ticket:
    now = timezone.now()
    ticket, created = Ticket.objects.get_or_create(
        project=project,
        title=spec['title'],
        defaults={
            'description': f'Demo scenario ticket ({spec["key"]}).',
            'type': spec['type'],
            'priority': spec['priority'],
            'status': 'new',
            'module': spec.get('module'),
            'created_by': creator,
        },
    )
    if not created:
        ticket.description = f'Demo scenario ticket ({spec["key"]}).'
        ticket.type = spec['type']
        ticket.priority = spec['priority']
        ticket.module = spec.get('module')
        ticket.created_by = creator
        ticket.save(
            update_fields=['description', 'type', 'priority', 'module', 'created_by', 'updated_at'],
        )

    if spec.get('due_in_days') is not None:
        ticket.due_date = (now + timedelta(days=spec['due_in_days'])).date()
        ticket.save(update_fields=['due_date', 'updated_at'])

    ticket.assignees.clear()
    if spec.get('assign') and assignee is not None:
        ticket.assignees.add(assignee)

    _apply_status_timestamps(ticket, spec['status'], now)
    return ticket


def _seed_ticket_scenarios(ctx: TenantContext) -> None:
    showcase = ctx.projects['website']
    admin = ctx.users['admin']
    assignee = ctx.users['employee_mike']

    for spec in TICKET_SCENARIO_CATALOG:
        ticket = _upsert_scenario_ticket(ctx, spec, showcase, admin, assignee)
        ctx.tickets[spec['key']] = ticket


def _seed_bulk_tickets(ctx: TenantContext, *, per_project: int = 6) -> None:
    managers = [u for key, u in ctx.users.items() if key.startswith('manager_')]
    employees = [u for key, u in ctx.users.items() if key.startswith('employee_')]
    staff = managers + employees
    statuses = ['new', 'in_progress', 'qa', 'closed', 'reopened']
    priorities = ['low', 'medium', 'high', 'critical']
    types = ['bug', 'task', 'feature']

    for project in ctx.projects.values():
        if project.status != 'active':
            continue
        project_members = list(
            User.objects.filter(projectmember__project=project).distinct(),
        )
        for index in range(per_project):
            title = f'{random.choice(BULK_TICKET_TITLES)} ({project.name[:12]})'
            if Ticket.objects.filter(project=project, title=title).exists():
                continue
            creator = random.choice(project_members or staff)
            ticket = Ticket.objects.create(
                title=title,
                description=random.choice(BULK_TICKET_DESCRIPTIONS),
                type=random.choice(types),
                priority=random.choice(priorities),
                status='new',
                project=project,
                created_by=creator,
                module=random.choice(['api', 'ui', 'notifications', 'settings', None]),
            )
            if random.random() > 0.15:
                ticket.assignees.add(random.choice(project_members or staff))
            _apply_status_timestamps(ticket, random.choice(statuses), timezone.now())


def _seed_historical_closed_tickets(ctx: TenantContext, *, days: int = 14) -> None:
    project = ctx.projects['analytics']
    closer = ctx.users['manager_sarah']
    now = timezone.now()

    for day_offset in range(days, 0, -2):
        closed_at = now - timedelta(days=day_offset)
        title = f'[History] Closed workload day {day_offset}'
        if Ticket.objects.filter(project=project, title=title).exists():
            continue
        ticket = Ticket.objects.create(
            title=title,
            description='Historical closed ticket for reports charts.',
            type='task',
            priority='medium',
            status='closed',
            project=project,
            created_by=closer,
            module='reports',
            created_at=closed_at - timedelta(days=2),
        )
        Ticket.objects.filter(pk=ticket.pk).update(
            created_at=closed_at - timedelta(days=2),
            in_progress_at=closed_at - timedelta(days=1),
            qa_at=closed_at - timedelta(hours=6),
            closed_at=closed_at,
        )
        ticket.assignees.add(ctx.users['employee_emily'])


def _seed_comments_and_worklogs(ctx: TenantContext) -> None:
    now = timezone.now()
    for ticket in Ticket.objects.filter(title__startswith='[Demo]'):
        assignee = ticket.assignees.first() or ctx.users['employee_mike']
        if not Comment.objects.filter(ticket=ticket).exists():
            Comment.objects.create(
                ticket=ticket,
                author=assignee,
                content=random.choice(COMMENT_TEMPLATES),
            )
        if ticket.status in {'in_progress', 'qa', 'reopened'} and not WorkLog.objects.filter(ticket=ticket).exists():
            start = now - timedelta(hours=3)
            WorkLog.objects.create(
                ticket=ticket,
                user=assignee,
                start_time=start,
                end_time=start + timedelta(minutes=90),
                notes=random.choice(WORK_LOG_NOTES),
            )


def _seed_activity_and_notifications(ctx: TenantContext) -> None:
    ticket_ct = ContentType.objects.get_for_model(Ticket)
    admin = ctx.users['admin']

    if not ActivityLog.objects.filter(action='create', user=admin, description__icontains='logged in').exists():
        ActivityLog.objects.create(
            action='create',
            user=admin,
            description='Demo admin logged in (seed)',
            extra_data={'source': 'populate_demo'},
        )

    for ticket in ctx.tickets.values():
        if Notification.objects.filter(
            user=ticket.assignees.first(),
            message__icontains=ticket.ticket_id,
        ).exists():
            continue
        assignee = ticket.assignees.first()
        if assignee is None:
            continue
        Notification.objects.create(
            user=assignee,
            message=f'You were assigned to {ticket.ticket_id}: {ticket.title}',
            ticket_id=ticket.id,
            ticket_title=ticket.title[:255],
            project_id=ticket.project_id,
            project_name=ticket.project.name[:255],
        )

        ActivityLog.objects.create(
            action='assignment_change',
            user=ctx.users['manager_john'],
            content_type=ticket_ct,
            object_id=ticket.id,
            description=f'Assigned ticket {ticket.ticket_id} to {assignee.username}',
            extra_data={'ticket_id': ticket.ticket_id},
        )


def _seed_todos_and_calendar(ctx: TenantContext) -> None:
    employee = ctx.users['employee_mike']
    today = timezone.localdate()

    for spec in TODO_CATALOG:
        TodoItem.objects.update_or_create(
            user=employee,
            title=spec['title'],
            defaults={
                'description': 'Demo todo from populate_demo.',
                'priority': spec['priority'],
                'status': spec['status'],
                'is_completed': spec['status'] == 'completed',
                'due_date': today + timedelta(days=3),
            },
        )

    manager = ctx.users['manager_john']
    for spec in CALENDAR_CATALOG:
        event_date = today + timedelta(days=spec['offset_days'])
        CalendarEvent.objects.update_or_create(
            title=spec['title'],
            date=event_date,
            defaults={
                'description': 'Demo calendar entry from populate_demo.',
                'category': spec['category'],
                'color': CalendarEvent.CATEGORY_COLORS.get(spec['category'], '#6b7280'),
                'created_by': manager,
                'is_full_day': True,
            },
        )


def run_all_demo_scenarios(ctx: TenantContext) -> TenantContext:
    _seed_ticket_scenarios(ctx)
    _seed_bulk_tickets(ctx)
    _seed_historical_closed_tickets(ctx)
    _seed_comments_and_worklogs(ctx)
    _seed_activity_and_notifications(ctx)
    _seed_todos_and_calendar(ctx)
    return ctx


# ---------------------------------------------------------------------------
# Legacy bulk populate (``manage.py populate_db``)
# ---------------------------------------------------------------------------


def clear_tenant_data() -> None:
    Comment.objects.all().delete()
    WorkLog.objects.all().delete()
    ActivityLog.objects.all().delete()
    Notification.objects.all().delete()
    Ticket.objects.all().delete()
    Project.objects.all().delete()
    TodoItem.objects.all().delete()
    CalendarEvent.objects.all().delete()
    User.objects.exclude(username=DEMO_ADMIN_USERNAME).delete()
    TicketIdCounter.objects.all().delete()


def run_legacy_bulk_populate(*, clear: bool = False, password: str = DEFAULT_PASSWORD) -> TenantContext:
    """Populate the **current** tenant schema with random volume data."""
    if clear:
        clear_tenant_data()

    schema = connection_schema_name()
    with schema_context(get_public_schema_name()):
        client = Client.objects.filter(schema_name=schema).first()
    if client is None:
        raise RuntimeError(f'No Client registry row for tenant schema "{schema}".')

    ctx = seed_existing_demo_tenant(client, password=password)
    run_all_demo_scenarios(ctx)
    return ctx


def connection_schema_name() -> str:
    from django.db import connection

    return getattr(connection, 'schema_name', '') or ''


# ---------------------------------------------------------------------------
# Full demo pipeline + summary
# ---------------------------------------------------------------------------


@transaction.atomic
def _seed_demo_tenant_data(client: Client, password: str) -> TenantContext:
    with schema_context(client.schema_name):
        ctx = seed_existing_demo_tenant(client, password=password)
        run_all_demo_scenarios(ctx)
    return ctx


def run_populate_demo(
    *,
    password: str = DEFAULT_PASSWORD,
    flush: bool = False,
    include_legacy_flush: bool = False,
) -> TenantContext:
    if flush:
        flush_demo_tenants(include_legacy=include_legacy_flush)

    _standard, premium = ensure_default_plans()
    upsert_platform_admin(password)
    client = ensure_demo_tenant(password=password, plan=premium)

    ctx = _seed_demo_tenant_data(client, password)
    resync_client_login_accounts(client)
    return ctx


def build_demo_summary(ctx: TenantContext, password: str) -> str:
    lines: list[str] = []
    client = ctx.client

    lines.append('=' * 60)
    lines.append('TICKETHUB DEMO DATA — SUMMARY')
    lines.append('=' * 60)
    lines.append(f'Tenant: {client.name} (schema={client.schema_name}, slug={client.slug})')
    lines.append(f'Login domain: @{client.login_domain}')
    lines.append(f'Platform admin: {PLATFORM_ADMIN_USERNAME} / {password}')
    lines.append('')

    with schema_context(client.schema_name):
        lines.append(f'Users: {User.objects.count()}')
        lines.append(
            f'Projects: {Project.objects.count()} '
            f'(active={Project.objects.filter(status="active").count()})'
        )
        lines.append(f'Tickets: {Ticket.objects.count()}')
        lines.append(f'Comments: {Comment.objects.count()}')
        lines.append(f'Work logs: {WorkLog.objects.count()}')
        lines.append(f'Activity logs: {ActivityLog.objects.count()}')
        lines.append(f'Todos: {TodoItem.objects.count()}')
        lines.append(f'Calendar events: {CalendarEvent.objects.count()}')

    lines.append('')
    lines.append('Sample logins (password for all seeded users):')
    lines.append(f'  {password}')
    lines.append('')
    for spec in TENANT_USER_CATALOG[:4]:
        user = ctx.users.get(spec['key'])
        if user is None:
            continue
        login_id = build_login_identifier(
            local_username=user.username,
            login_domain=client.login_domain,
        )
        lines.append(f'  {spec["role"]:8} {login_id}')
    lines.append('  ... see docs/populate.md for the full account list')
    lines.append('')
    lines.append('Scenario tickets on Website Redesign:')
    for key, ticket in ctx.tickets.items():
        lines.append(f'  {key}: {ticket.ticket_id} ({ticket.status})')
    lines.append('=' * 60)
    return '\n'.join(lines)
