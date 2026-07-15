'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { PlatformProtectedRoute } from '@/components/platform-protected-route';
import { ThemeToggle } from '@/components/theme-toggle';
import { usePlatformAuth } from '@/lib/platform-auth-context';

const NAV_ITEMS = [
  { href: '/server/dashboard', label: 'Overview', icon: IconOverview },
  { href: '/server/dashboard/tenants', label: 'Organizations', icon: IconOrganizations },
  { href: '/server/dashboard/plans', label: 'Plans', icon: IconPlans },
] as const;

export default function ServerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProtectedRoute>
      <ServerDashboardShell>{children}</ServerDashboardShell>
    </PlatformProtectedRoute>
  );
}

function ServerDashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = usePlatformAuth();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const handleEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setExpanded(true);
  };

  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => setExpanded(false), 200);
  };

  const isActive = (href: string) =>
    href === '/server/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen grid-bg relative flex">
      <aside
        className={`dashboard-sidebar server-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden transition-[width,box-shadow] duration-200 ease-out ${expanded ? 'dashboard-sidebar--expanded' : ''}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark server-brand-mark" aria-hidden="true">P</div>
          {expanded && <span className="sidebar-brand-name">Platform Console</span>}
        </div>

        <nav className="sidebar-nav relative z-10">
          <div className="sidebar-section">
            {expanded && <p className="sidebar-section-label">Management</p>}
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                className={`sidebar-link${isActive(item.href) ? ' sidebar-link-active' : ''}`}
              >
                <span className="sidebar-link-icon">
                  <item.icon />
                </span>
                {expanded && <span className="sidebar-link-label">{item.label}</span>}
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      <main className="relative z-10 ml-[52px] flex-1 overflow-y-auto min-h-screen">
        <header
          className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b app-chrome-header"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="server-header-chip">
            <span className="server-header-chip-dot" aria-hidden="true" />
            Server administrator
          </div>

          <div className="app-header-actions">
            <ThemeToggle />
            <span className="app-header-divider" aria-hidden="true" />
            <div className="app-header-profile" title={user?.username}>
              <span className="app-header-avatar server-header-avatar" aria-hidden="true">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
              <span className="app-header-profile-text">
                <span className="app-header-profile-role">Platform</span>
                <span className="app-header-profile-name">{user?.username}</span>
              </span>
            </div>
            <button type="button" onClick={logout} className="icon-btn icon-btn-danger" aria-label="Log out" title="Log out">
              <IconLogout />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function SidebarIcon({ children }: { children: ReactNode }) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconOverview() {
  return (
    <SidebarIcon>
      <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </SidebarIcon>
  );
}

function IconOrganizations() {
  return (
    <SidebarIcon>
      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </SidebarIcon>
  );
}

function IconPlans() {
  return (
    <SidebarIcon>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
