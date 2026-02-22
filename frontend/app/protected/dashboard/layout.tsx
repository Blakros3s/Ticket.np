'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const canManage = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const isActive = (path: string) => {
    if (path === '/protected/dashboard' && pathname === '/protected/dashboard') {
      return true;
    }
    if (path !== '/protected/dashboard' && pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen grid-bg relative flex">
      {/* Background Effects */}
      <div className="orb orb-1 pulse-animation"></div>
      <div className="orb orb-2 pulse-animation" style={{ animationDelay: '2s' }}></div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-50 h-screen bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            {sidebarOpen && (
              <span className="text-xl font-bold gradient-text whitespace-nowrap">TechnestHub</span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {/* Dashboard */}
          <div className="mb-6">
            {sidebarOpen && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Overview
              </h3>
            )}
            <Link
              href="/protected/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard')
                ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">Dashboard</span>}
            </Link>
            <Link
              href="/protected/dashboard/attendance"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/attendance')
                ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">Attendance</span>}
            </Link>
            <Link
              href="/protected/dashboard/leave"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/leave')
                ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">Leave</span>}
            </Link>
          </div>

          {/* Ticket Projects Group */}
          <div className="mb-6">
            {sidebarOpen && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ticket Projects
              </h3>
            )}
            <div className="space-y-1">
              <Link
                href="/protected/dashboard/tickets"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/tickets')
                  ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                {sidebarOpen && <span className="whitespace-nowrap">Tickets</span>}
              </Link>
              <Link
                href="/protected/dashboard/projects"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/projects')
                  ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {sidebarOpen && <span className="whitespace-nowrap">Projects</span>}
              </Link>
            </div>
          </div>

          {/* Todo Task Group */}
          <div className="mb-6">
            {sidebarOpen && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Todo Task
              </h3>
            )}
            <div className="space-y-1">
              <Link
                href="/protected/dashboard/calendar"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/calendar')
                  ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {sidebarOpen && <span className="whitespace-nowrap">Calendar</span>}
              </Link>
              <Link
                href="/protected/dashboard/todos"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/todos')
                  ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {sidebarOpen && <span className="whitespace-nowrap">Todo Task</span>}
              </Link>
            </div>
          </div>

          {/* User Management Group */}
          {canManage && (
            <div className="mb-6">
              {sidebarOpen && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  User Management
                </h3>
              )}
              <div className="space-y-1">
                <Link
                  href="/protected/dashboard/users"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/users')
                    ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {sidebarOpen && <span className="whitespace-nowrap">Users</span>}
                </Link>
              </div>
            </div>
          )}

          {/* Admin Settings */}
          {canManage && (
            <div className="mb-6">
              {sidebarOpen && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Admin
                </h3>
              )}
              <div className="space-y-1">
                <Link
                  href="/protected/dashboard/settings"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/settings')
                    ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {sidebarOpen && <span className="whitespace-nowrap">Settings</span>}
                </Link>
              </div>
            </div>
          )}

          {/* Reports */}
          <div>
            {sidebarOpen && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Analytics
              </h3>
            )}
            <Link
              href="/protected/dashboard/reports"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/protected/dashboard/reports')
                ? 'bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border-l-2 border-sky-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {sidebarOpen && <span className="whitespace-nowrap">Reports</span>}
            </Link>

            {isEmployee && (
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all text-slate-400 hover:bg-slate-800/50 hover:text-white"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {sidebarOpen && <span className="whitespace-nowrap">How to?</span>}
              </button>
            )}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-slate-700/50 p-4">
          <Link
            href="/protected/dashboard/profile"
            className="flex items-center gap-3 mb-4 hover:bg-slate-800/50 p-2 -m-2 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            )}
          </Link>

          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`relative z-10 flex-1 overflow-y-auto min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {children}
      </main>

      {/* Help Modal for Employees */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">How to Use TechnestHub</h2>
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
                    <span><strong>Self-assign tickets</strong> - If a ticket has no assignee, click &quot;Self-assign&quot; to work on it</span>
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
                    <span><strong>Update your info</strong> - Click your name in the sidebar to edit profile</span>
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
