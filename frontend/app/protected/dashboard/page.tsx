'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  dashboardApi,
  EmployeeDashboard,
  AdminDashboard,
  ManagerDashboard,
} from '@/lib/dashboard';
import { useSettings } from '@/lib/settings-context';
import { useNotifications } from '@/lib/notifications-context';

const STATUS_LINK_COLOR: Record<string, string> = {
  new: 'dashboard-stat-accent-blue',
  in_progress: 'dashboard-stat-accent-amber',
  qa: 'dashboard-stat-accent-purple',
  closed: 'dashboard-stat-accent-green',
  reopened: 'dashboard-stat-accent-red',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'dashboard-stat-accent-red',
  high: 'dashboard-stat-accent-amber',
  medium: 'dashboard-stat-accent-sky',
  low: 'dashboard-stat-accent-green',
};

const TICKET_STATUSES = ['new', 'in_progress', 'qa', 'closed', 'reopened'] as const;

function formatRoleLabel(role: string | undefined, developerLabel: string): string {
  if (!role) return '';
  if (role === 'employee') return developerLabel;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function roleBadgeClass(role: string | undefined): string {
  if (role === 'admin') return 'badge-neutral dashboard-stat-accent-red';
  if (role === 'manager') return 'badge-warning';
  return 'badge-success';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { terminology } = useSettings();
  const { unreadCount } = useNotifications();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeDashboard | null>(null);
  const [managerData, setManagerData] = useState<ManagerDashboard | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const roleLabel = formatRoleLabel(user?.role, terminology.label);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const requests: Promise<void>[] = [
          dashboardApi.getEmployeeDashboard().then(setEmployeeData),
        ];
        if (isManager) {
          requests.push(dashboardApi.getManagerDashboard().then(setManagerData));
        }
        if (isAdmin) {
          requests.push(dashboardApi.getAdminDashboard().then(setAdminData));
        }
        await Promise.all(requests);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user, isAdmin, isManager]);

  const subtitle = isAdmin
    ? 'Organization overview and your personal work at a glance.'
    : isManager
      ? 'Track your team, projects, and assigned work from one place.'
      : 'Your tickets, time, and activity in one place.';

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold mb-2">
              Welcome back,{' '}
              <span style={{ color: 'var(--accent)' }}>{user?.first_name}</span>
            </h1>
            <p className="page-subtitle mb-1">{subtitle}</p>
            <p className="meta-text">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {' '}&bull;{' '}
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <span
            className={`badge ${roleBadgeClass(user?.role)} self-start`}
            style={{ textTransform: 'capitalize', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
          >
            {roleLabel}
          </span>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg"
          style={{
            background: 'var(--danger-muted)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
          }}
        >
          <p style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2"
            style={{ borderColor: 'var(--accent)' }}
          />
        </div>
      ) : (
        <>
          {employeeData && (
            <div className="dashboard-kpi-grid">
              <Link href="/protected/dashboard/my-tickets" className="stat-card stat-card--interactive">
                <p className="stat-card-label">Assigned to me</p>
                <p className="stat-card-value dashboard-stat-accent-blue">
                  {employeeData.assigned_tickets_count}
                </p>
              </Link>
              <Link
                href="/protected/dashboard/my-tickets?status=in_progress"
                className="stat-card stat-card--interactive"
              >
                <p className="stat-card-label">In progress</p>
                <p className="stat-card-value dashboard-stat-accent-amber">
                  {employeeData.in_progress_count}
                </p>
              </Link>
              <Link
                href="/protected/dashboard/my-tickets?status=closed"
                className="stat-card stat-card--interactive"
              >
                <p className="stat-card-label">Completed</p>
                <p className="stat-card-value dashboard-stat-accent-green">
                  {employeeData.completed_tickets_count}
                </p>
              </Link>
              <div className="stat-card">
                <p className="stat-card-label">Time logged</p>
                <p className="stat-card-value dashboard-stat-accent-violet">
                  {employeeData.total_time_logged_hours}h
                </p>
              </div>
            </div>
          )}

          {employeeData?.active_session && (
            <div className="dashboard-alert mb-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full animate-pulse dashboard-stat-accent-amber"
                  style={{ background: 'currentColor' }}
                />
                <div>
                  <p className="dashboard-stat-accent-amber font-medium">Active work session</p>
                  <p className="page-subtitle text-sm">
                    Working on {employeeData.active_session.ticket_id}:{' '}
                    {employeeData.active_session.ticket_title}
                  </p>
                </div>
              </div>
              <Link
                href={`/protected/dashboard/tickets/${employeeData.active_session.id}`}
                className="dashboard-link"
              >
                View ticket →
              </Link>
            </div>
          )}

          {employeeData && employeeData.tickets_due_soon > 0 && (
            <div className="dashboard-info-banner dashboard-info-banner--warning mb-6">
              <div>
                <p className="font-medium dashboard-stat-accent-amber">Stale tickets</p>
                <p className="page-subtitle text-sm">
                  {employeeData.tickets_due_soon} assigned ticket
                  {employeeData.tickets_due_soon === 1 ? '' : 's'} open for more than 7 days
                </p>
              </div>
              <Link href="/protected/dashboard/my-tickets" className="dashboard-link whitespace-nowrap">
                Review →
              </Link>
            </div>
          )}

          {managerData && managerData.unassigned_tickets > 0 && (
            <div className="dashboard-info-banner dashboard-info-banner--info mb-6">
              <div>
                <p className="font-medium" style={{ color: 'var(--accent)' }}>
                  Unassigned tickets
                </p>
                <p className="page-subtitle text-sm">
                  {managerData.unassigned_tickets} ticket
                  {managerData.unassigned_tickets === 1 ? '' : 's'} in your projects need assignees
                </p>
              </div>
              <Link href="/protected/dashboard/tickets" className="dashboard-link whitespace-nowrap">
                Assign →
              </Link>
            </div>
          )}

          <div className="dashboard-two-col mb-8">
            {employeeData && (
              <div className="surface-panel overflow-hidden">
                <div className="surface-panel-header">
                  <h3 className="surface-panel-title">My tickets</h3>
                  <Link href="/protected/dashboard/my-tickets" className="dashboard-link">
                    View all →
                  </Link>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {TICKET_STATUSES.map((status) => {
                      const statusTickets = employeeData.my_tickets_by_status?.[status] || [];
                      const statusLabel = status.replace('_', ' ');
                      return (
                        <div key={status} className="dashboard-inner-card">
                          <Link
                            href={`/protected/dashboard/my-tickets?status=${status}`}
                            className={`text-sm font-medium mb-2 capitalize flex items-center justify-between hover:underline ${STATUS_LINK_COLOR[status]}`}
                          >
                            <span>
                              {statusLabel} ({statusTickets.length})
                            </span>
                            <span className="text-xs opacity-60">→</span>
                          </Link>
                          <div className="space-y-2 max-h-36 overflow-y-auto">
                            {statusTickets.length === 0 ? (
                              <p className="meta-text text-xs">None</p>
                            ) : (
                              statusTickets.slice(0, 5).map((ticket) => (
                                <Link
                                  key={ticket.id}
                                  href={`/protected/dashboard/tickets/${ticket.id}`}
                                  className="dashboard-ticket-link"
                                >
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span
                                      className={`dashboard-priority-dot ${PRIORITY_COLOR[ticket.priority] || ''}`}
                                      style={{ background: 'currentColor' }}
                                    />
                                    <p className="dashboard-ticket-id truncate">{ticket.ticket_id}</p>
                                  </div>
                                  <p className="dashboard-ticket-meta truncate">{ticket.title}</p>
                                  {ticket.project_name && (
                                    <p className="meta-text text-xs truncate mt-0.5">
                                      {ticket.project_name}
                                    </p>
                                  )}
                                </Link>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-6">
              {employeeData && employeeData.recent_activity.length > 0 && (
                <div className="surface-panel p-5">
                  <h3 className="surface-panel-title mb-4">Recent activity</h3>
                  <div className="dashboard-activity-feed">
                    {employeeData.recent_activity.map((item) => (
                      <div key={item.id} className="dashboard-activity-item">
                        <div className="dashboard-activity-dot" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate capitalize" style={{ color: 'var(--text-primary)' }}>
                            {item.action.replace(/_/g, ' ')}
                          </p>
                          <p className="meta-text text-xs line-clamp-2">{item.description}</p>
                          <p className="meta-text text-xs mt-1">
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {managerData && (
                <div className="surface-panel p-5">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="surface-panel-title">Team snapshot</h3>
                    <Link href="/protected/dashboard/reports" className="dashboard-link text-sm">
                      Reports →
                    </Link>
                  </div>
                  <div className="dashboard-kpi-grid mb-4" style={{ marginBottom: '1rem' }}>
                    <div className="dashboard-inner-card text-center py-3">
                      <p className="stat-card-value dashboard-stat-accent-sky text-xl">
                        {managerData.active_projects}
                      </p>
                      <p className="meta-text text-xs">Active projects</p>
                    </div>
                    <div className="dashboard-inner-card text-center py-3">
                      <p className="stat-card-value dashboard-stat-accent-amber text-xl">
                        {managerData.total_tickets}
                      </p>
                      <p className="meta-text text-xs">Project tickets</p>
                    </div>
                  </div>
                  {managerData.team_workload.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {managerData.team_workload.slice(0, 8).map((member, idx) => (
                        <div key={`${member.user_id}-${member.project_id}-${idx}`} className="dashboard-row-item">
                          <div className="min-w-0">
                            <p className="dashboard-row-value text-sm truncate">{member.user_name}</p>
                            <p className="meta-text text-xs truncate">{member.project_name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">{member.assigned_tickets} assigned</p>
                            <p className="meta-text text-xs">{member.in_progress} in progress</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="meta-text text-sm">No team workload data yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {managerData && managerData.recent_tickets.length > 0 && (
            <div className="surface-panel overflow-hidden mb-8">
              <div className="surface-panel-header">
                <h3 className="surface-panel-title">Recent project tickets</h3>
                <Link href="/protected/dashboard/tickets" className="dashboard-link">
                  All tickets →
                </Link>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {managerData.recent_tickets.slice(0, 6).map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/protected/dashboard/tickets/${ticket.id}`}
                    className="dashboard-list-row block"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="dashboard-ticket-id">{ticket.ticket_id}</span>
                        <span
                          className={`text-xs capitalize ${STATUS_LINK_COLOR[ticket.status] || 'meta-text'}`}
                        >
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-xs capitalize ${PRIORITY_COLOR[ticket.priority] || 'meta-text'}`}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {ticket.title}
                      </p>
                      <p className="meta-text text-xs truncate">
                        {ticket.project_name} &bull; {ticket.assignee_name}
                      </p>
                    </div>
                    <span className="meta-text text-xs shrink-0 ml-4">
                      {formatRelativeTime(ticket.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {adminData && (
            <div className="mb-8">
              <h2 className="dashboard-section-title">
                <svg
                  className="w-6 h-6 dashboard-stat-accent-red"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                System overview
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Link href="/protected/dashboard/users" className="stat-card stat-card--interactive">
                  <p className="stat-card-label">Total users</p>
                  <p className="stat-card-value">{adminData.users.total}</p>
                  <p className="meta-text dashboard-stat-accent-green mt-1">
                    +{adminData.users.recent} this week
                  </p>
                </Link>
                <Link href="/protected/dashboard/projects" className="stat-card stat-card--interactive">
                  <p className="stat-card-label">Total projects</p>
                  <p className="stat-card-value dashboard-stat-accent-sky">{adminData.projects.total}</p>
                  <p className="meta-text mt-1">{adminData.projects.active} active</p>
                </Link>
                <Link href="/protected/dashboard/tickets" className="stat-card stat-card--interactive">
                  <p className="stat-card-label">Total tickets</p>
                  <p className="stat-card-value dashboard-stat-accent-amber">{adminData.tickets.total}</p>
                  <p className="meta-text mt-1">+{adminData.tickets.recent} this week</p>
                </Link>
                <div className="stat-card">
                  <p className="stat-card-label">Total time logged</p>
                  <p className="stat-card-value dashboard-stat-accent-violet">
                    {adminData.work_logs.total_hours}h
                  </p>
                  <p className="meta-text mt-1">{adminData.work_logs.total} work logs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="surface-panel p-6">
                  <h3 className="surface-panel-title mb-4">Users by role</h3>
                  <div className="space-y-3">
                    {Object.entries(adminData.users.by_role).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              role === 'admin'
                                ? 'bg-red-500'
                                : role === 'manager'
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                            }`}
                          />
                          <span className="dashboard-row-label capitalize">
                            {role === 'employee' ? terminology.labelPlural : `${role}s`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="dashboard-progress-track">
                            <div
                              className={`h-2 rounded-full ${
                                role === 'admin'
                                  ? 'bg-red-500'
                                  : role === 'manager'
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${adminData.users.total ? (count / adminData.users.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="dashboard-row-value w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="surface-panel p-6">
                  <h3 className="surface-panel-title mb-4">Recent activity</h3>
                  <div className="space-y-3">
                    {Object.entries(adminData.activity.by_type).map(([action, count]) => (
                      <div key={action} className="dashboard-row-item">
                        <span className="dashboard-row-label capitalize">
                          {action.replace('_', ' ')}
                        </span>
                        <span className="dashboard-row-value">{count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="meta-text mt-4">
                    {adminData.activity.recent_count} activities in the last 7 days
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="surface-panel p-6">
            <h2 className="surface-panel-title mb-4">Quick access</h2>
            <div className="dashboard-quick-grid">
              <QuickLink
                href="/protected/dashboard/my-tickets"
                label="My tickets"
                description="Your assignments"
                accentClass="dashboard-stat-accent-blue"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/tickets"
                label="All tickets"
                description="Browse every ticket"
                accentClass="dashboard-stat-accent-amber"
                mutedVar="--warning-muted"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/projects"
                label="Projects"
                description="Manage projects"
                accentClass=""
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/todos"
                label="Todos"
                description="Personal tasks"
                accentClass="dashboard-stat-accent-green"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/calendar"
                label="Calendar"
                description="Events & schedule"
                accentClass="dashboard-stat-accent-purple"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/attendance"
                label="Attendance"
                description="Clock in & out"
                accentClass="dashboard-stat-accent-sky"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                }
              />
              <QuickLink
                href="/protected/dashboard/notifications"
                label="Notifications"
                description={
                  unreadCount > 0 ? `${unreadCount} unread` : 'Stay updated'
                }
                accentClass="dashboard-stat-accent-red"
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                }
              />
              {(isManager || isAdmin) && (
                <QuickLink
                  href="/protected/dashboard/reports"
                  label="Reports"
                  description="Analytics & trends"
                  accentClass="dashboard-stat-accent-violet"
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  }
                />
              )}
              {isAdmin && (
                <>
                  <QuickLink
                    href="/protected/dashboard/users"
                    label={terminology.labelPlural}
                    description="Manage team"
                    accentClass="dashboard-stat-accent-violet"
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    }
                  />
                  <QuickLink
                    href="/protected/dashboard/settings"
                    label="Settings"
                    description="Organization config"
                    accentClass=""
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                    }
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuickLink({
  href,
  label,
  description,
  icon,
  accentClass = '',
  mutedVar = '--accent-muted',
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  accentClass?: string;
  mutedVar?: string;
}) {
  return (
    <Link href={href} className="dashboard-quick-link">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}
        style={{ background: `var(${mutedVar})`, color: accentClass ? undefined : 'var(--accent)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div className="min-w-0">
        <p className="dashboard-row-value text-sm">{label}</p>
        <p className="meta-text truncate">{description}</p>
      </div>
    </Link>
  );
}
