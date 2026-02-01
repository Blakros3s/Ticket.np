'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const isActive = (path: string) => {
    if (path === '/protected/dashboard' && pathname === '/protected/dashboard') {
      return true;
    }
    if (path !== '/protected/dashboard' && pathname.startsWith(path)) {
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen grid-bg relative">
      {/* Background Effects */}
      <div className="orb orb-1 pulse-animation"></div>
      <div className="orb orb-2 pulse-animation" style={{ animationDelay: '2s' }}></div>

      {/* Permanent Header/Navbar */}
      <nav className="relative z-50 border-b border-slate-700/50 backdrop-blur-md bg-slate-900/80 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <span className="text-xl font-bold gradient-text">TicketHub</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link 
                href="/protected/dashboard" 
                className={`transition-colors nav-link ${isActive('/protected/dashboard') ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Dashboard
              </Link>
              <Link 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors nav-link"
              >
                Tickets
              </Link>
              <Link 
                href="/protected/dashboard/projects" 
                className={`transition-colors nav-link ${isActive('/protected/dashboard/projects') ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Projects
              </Link>
              <Link 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors nav-link"
              >
                Reports
              </Link>
              {canManage && (
                <Link 
                  href="/protected/dashboard/users" 
                  className={`transition-colors nav-link ${isActive('/protected/dashboard/users') ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Users
                </Link>
              )}
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-3">
              <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full"></span>
              </button>

              <div className="h-8 w-px bg-slate-700"></div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}
