'use client';

import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { useState, useEffect } from 'react';

function DashboardContent() {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: 'Open Tickets', value: '12', change: '+3', color: 'sky' },
    { label: 'In Progress', value: '8', change: '+1', color: 'violet' },
    { label: 'Resolved', value: '45', change: '+12', color: 'green' },
    { label: 'Priority', value: 'High', change: '2 urgent', color: 'amber' },
  ];

  const recentTickets = [
    { id: 'T-1024', title: 'Server performance issue', status: 'Open', priority: 'High', time: '2 hours ago' },
    { id: 'T-1023', title: 'Database backup failure', status: 'In Progress', priority: 'Critical', time: '4 hours ago' },
    { id: 'T-1022', title: 'User access request', status: 'Resolved', priority: 'Medium', time: '6 hours ago' },
    { id: 'T-1021', title: 'API endpoint timeout', status: 'Open', priority: 'High', time: '1 day ago' },
  ];

  return (
    <div className="min-h-screen grid-bg relative">
      <div className="orb orb-1 pulse-animation"></div>
      <div className="orb orb-2 pulse-animation" style={{ animationDelay: '2s' }}></div>

      <nav className="relative z-10 border-b border-slate-700/50 backdrop-blur-md bg-slate-900/30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <span className="text-xl font-bold gradient-text">TicketHub</span>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6">
                <a href="#" className="text-slate-400 hover:text-white transition-colors nav-link">Dashboard</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors nav-link">Tickets</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors nav-link">Projects</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors nav-link">Reports</a>
              </div>

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
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, <span className="gradient-text">{user?.first_name}</span>
          </h1>
          <p className="text-slate-400">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' '}&bull;{' '}
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' '}&bull;{' '}
            <span className="text-green-400">System Online</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="card glow-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                  </svg>
                </div>
                <span className="text-sm text-green-400">{stat.change}</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
              <p className="text-sm text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card glow-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Tickets</h2>
                <button className="text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors border border-slate-700/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{ticket.title}</p>
                        <p className="text-sm text-slate-400 code-font">{ticket.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-sky-500/20 text-sky-400">
                        {ticket.status}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{ticket.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card glow-border rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-sky-500/10 border border-slate-700/50 hover:border-sky-500/30 transition-all duration-300 text-left">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-white">New Ticket</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-violet-500/10 border border-slate-700/50 hover:border-violet-500/30 transition-all duration-300 text-left">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <span className="text-white">Search</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-green-500/10 border border-slate-700/50 hover:border-green-500/30 transition-all duration-300 text-left">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-white">Reports</span>
                </button>
              </div>
            </div>

            <div className="card glow-border rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">API Server</span>
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Database</span>
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Operational
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email Service</span>
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
