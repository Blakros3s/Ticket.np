'use client';

import { useAuth } from '@/lib/auth-context';
import { NotificationsProvider, useNotifications } from '@/lib/notifications-context';
import { SettingsProvider, useSettings } from '@/lib/settings-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { SWRConfig } from 'swr';
import { ThemeToggle } from '@/components/theme-toggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SWRConfig value={{ dedupingInterval: 60_000, revalidateOnFocus: false }}>
      <SettingsProvider>
        <NotificationsProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </NotificationsProvider>
      </SettingsProvider>
    </SWRConfig>
  );
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { terminology } = useSettings();
  const pathname = usePathname();
  const canManage = user?.role === 'admin';
  const isDeveloperRole = user?.role === 'employee';
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const sidebarLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarEnter = () => {
    if (sidebarLeaveTimer.current) {
      clearTimeout(sidebarLeaveTimer.current);
      sidebarLeaveTimer.current = null;
    }
    setSidebarHovered(true);
  };

  const handleSidebarLeave = () => {
    sidebarLeaveTimer.current = setTimeout(() => {
      setSidebarHovered(false);
    }, 200);
  };

  const isActive = (path: string) => {
    if (path === '/protected/dashboard') {
      return pathname === '/protected/dashboard';
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const expanded = sidebarHovered;

  const navGroups = useMemo(() => {
    const groups: NavGroup[] = [
      {
        label: 'Overview',
        items: [
          { href: '/protected/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
          { href: '/protected/dashboard/attendance', label: 'Attendance', icon: <IconClock /> },
          { href: '/protected/dashboard/leave', label: 'Leave', icon: <IconUsers /> },
        ],
      },
      {
        label: 'Work',
        items: [
          { href: '/protected/dashboard/tickets', label: 'Tickets', icon: <IconTicket /> },
          { href: '/protected/dashboard/tickets/board', label: 'Board', icon: <IconKanban /> },
          { href: '/protected/dashboard/projects', label: 'Projects', icon: <IconFolder /> },
          { href: '/protected/dashboard/docs', label: 'Docs', icon: <IconDocs /> },
          { href: '/protected/dashboard/whiteboards', label: 'Whiteboards', icon: <IconWhiteboard /> },
        ],
      },
      {
        label: 'Tasks',
        items: [
          { href: '/protected/dashboard/calendar', label: 'Calendar', icon: <IconCalendar /> },
          { href: '/protected/dashboard/todos', label: 'Todos', icon: <IconChecklist /> },
        ],
      },
    ];

    if (canManage) {
      groups.push({
        label: 'Admin',
        items: [
          { href: '/protected/dashboard/users', label: terminology.labelPlural, icon: <IconTeam /> },
          { href: '/protected/dashboard/settings', label: 'Settings', icon: <IconSettings /> },
        ],
      });
    }

    groups.push({
      label: 'Insights',
      items: [
        { href: '/protected/dashboard/reports', label: 'Reports', icon: <IconChart /> },
      ],
    });

    return groups;
  }, [canManage, terminology.labelPlural]);

  useEffect(() => {
    return () => {
      if (sidebarLeaveTimer.current) {
        clearTimeout(sidebarLeaveTimer.current);
      }
    };
  }, []);

  return (
    <div className="h-screen grid-bg relative flex overflow-hidden">
      {/* Background Effects */}
      <div className="orb orb-1 pulse-animation"></div>
      <div className="orb orb-2 pulse-animation" style={{ animationDelay: '2s' }}></div>

      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden transition-[width,box-shadow] duration-200 ease-out ${expanded ? 'dashboard-sidebar--expanded' : ''}`}
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" aria-hidden="true">T</div>
          {expanded && <span className="sidebar-brand-name">TechnestHub</span>}
        </div>

        <nav className="sidebar-nav relative z-10">
          {navGroups.map((group, index) => (
            <div key={group.label} className="sidebar-section">
              {!expanded && index > 0 && <div className="sidebar-divider" aria-hidden="true" />}
              {expanded && <p className="sidebar-section-label">{group.label}</p>}
              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.href)}
                  expanded={expanded}
                />
              ))}
            </div>
          ))}

          {isDeveloperRole && (
            <div className="sidebar-section">
              {!expanded && <div className="sidebar-divider" aria-hidden="true" />}
              <SidebarButton
                label="How to?"
                icon={<IconHelp />}
                expanded={expanded}
                onClick={() => setShowHelp(true)}
              />
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 ml-[52px] flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="z-40 flex shrink-0 items-center justify-end gap-2 px-4 sm:px-6 py-2.5 border-b app-chrome-header"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="app-header-actions">
            <Link
              href="/protected/dashboard/notifications"
              className={`icon-btn app-header-icon-link${isActive('/protected/dashboard/notifications') ? ' app-header-profile--active' : ''}`}
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell />
              {unreadCount > 0 && (
                <span className="app-header-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </Link>

            <ThemeToggle />

            <span className="app-header-divider" aria-hidden="true" />

            <Link
              href="/protected/dashboard/profile"
              className={`app-header-profile${isActive('/protected/dashboard/profile') ? ' app-header-profile--active' : ''}`}
              title="Profile"
            >
              <span className="app-header-avatar" aria-hidden="true">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
              <span className="app-header-profile-text">
                <span className="app-header-profile-role">
                  {user?.role === 'employee'
                    ? terminology.label
                    : user?.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : ''}
                </span>
                <span className="app-header-profile-name">
                  {user?.first_name || user?.last_name
                    ? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
                    : user?.username}
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={logout}
              className="icon-btn icon-btn-danger"
              aria-label="Log out"
              title="Log out"
            >
              <IconLogout />
            </button>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Help Modal for Developers */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="dashboard-section-title">How to Use {terminology.label} Hub</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  </span>
                  My Tickets
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-1">•</span>
                    <span><strong>View all your tickets</strong> - See tickets assigned to you in the Tickets page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-1">•</span>
                    <span><strong>Self-assign tickets</strong> - Project members can add themselves to unassigned tickets or join others already assigned</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-1">•</span>
                    <span><strong>Update ticket status</strong> - Move tickets through: New → In Progress → QA → Closed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-1">•</span>
                    <span><strong>Add attachments</strong> - Upload files, images, or documents to any ticket in your project</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 mt-1">•</span>
                    <span><strong>Add comments</strong> - Discuss ticket details with your team</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Time Tracking
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span><strong>Timer starts automatically</strong> - When you move a ticket to &quot;In Progress&quot;, the timer begins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span><strong>Timer shows while working</strong> - You&apos;ll see the running timer on ticket details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span><strong>Timer stops when closed</strong> - When ticket is marked &quot;Closed&quot;, time is logged automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span><strong>Reopening restarts timer</strong> - If a ticket is reopened and goes back to In Progress, timer starts again</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </span>
                  Reports
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span><strong>Track your performance</strong> - See how many tickets you&apos;ve completed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span><strong>View time spent</strong> - Check hours worked on each project</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span><strong>Filter by time</strong> - Use the dropdown to see reports for 7, 14, 30, 60, or 90 days</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </span>
                  Projects
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-1">•</span>
                    <span><strong>View your projects</strong> - See all projects you&apos;re a member of</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-1">•</span>
                    <span><strong>View project documents</strong> - Access files shared in each project</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  Your Profile
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong>Update your info</strong> - Open your profile from the top-right corner of the page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong>Change password</strong> - Update your password anytime from profile page</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full btn-primary py-2.5"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  expanded: boolean;
  badge?: number;
}

function SidebarLink({ href, label, icon, active, expanded, badge }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      title={!expanded ? label : undefined}
      aria-label={label}
      className={`sidebar-link${active ? ' sidebar-link-active' : ''}`}
    >
      <span className="sidebar-link-icon relative">
        {icon}
        {badge != null && badge > 0 && (
          <span className="sidebar-link-badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </span>
      {expanded && <span className="sidebar-link-label">{label}</span>}
    </Link>
  );
}

interface SidebarButtonProps {
  label: string;
  icon: ReactNode;
  expanded: boolean;
  onClick: () => void;
  className?: string;
}

function SidebarButton({ label, icon, expanded, onClick, className }: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={!expanded ? label : undefined}
      aria-label={label}
      className={`sidebar-link w-full${className ? ` ${className}` : ''}`}
    >
      <span className="sidebar-link-icon">{icon}</span>
      {expanded && <span className="sidebar-link-label">{label}</span>}
    </button>
  );
}

function SidebarIcon({ children }: { children: ReactNode }) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard() {
  return (
    <SidebarIcon>
      <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </SidebarIcon>
  );
}

function IconClock() {
  return (
    <SidebarIcon>
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </SidebarIcon>
  );
}

function IconUsers() {
  return (
    <SidebarIcon>
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </SidebarIcon>
  );
}

function IconTicket() {
  return (
    <SidebarIcon>
      <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </SidebarIcon>
  );
}

function IconKanban() {
  return (
    <SidebarIcon>
      <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </SidebarIcon>
  );
}

function IconDocs() {
  return (
    <SidebarIcon>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </SidebarIcon>
  );
}

function IconWhiteboard() {
  return (
    <SidebarIcon>
      <path d="M4 5h16v12H4z" />
      <path d="M8 9h8M8 13h5" />
    </SidebarIcon>
  );
}

function IconFolder() {
  return (
    <SidebarIcon>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </SidebarIcon>
  );
}

function IconCalendar() {
  return (
    <SidebarIcon>
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </SidebarIcon>
  );
}

function IconChecklist() {
  return (
    <SidebarIcon>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </SidebarIcon>
  );
}

function IconTeam() {
  return (
    <SidebarIcon>
      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </SidebarIcon>
  );
}

function IconSettings() {
  return (
    <SidebarIcon>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </SidebarIcon>
  );
}

function IconChart() {
  return (
    <SidebarIcon>
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </SidebarIcon>
  );
}

function IconHelp() {
  return (
    <SidebarIcon>
      <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </SidebarIcon>
  );
}

function IconBell() {
  return (
    <SidebarIcon>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </SidebarIcon>
  );
}

function IconLogout() {
  return (
    <SidebarIcon>
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </SidebarIcon>
  );
}
