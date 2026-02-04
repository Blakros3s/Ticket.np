'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dashboardApi, EmployeeDashboard, ManagerDashboard, AdminDashboard } from '@/lib/dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeDashboard | null>(null);
  const [managerData, setManagerData] = useState<ManagerDashboard | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isAdmin) {
          const [admin, manager, employee] = await Promise.all([
            dashboardApi.getAdminDashboard(),
            dashboardApi.getManagerDashboard(),
            dashboardApi.getEmployeeDashboard(),
          ]);
          setAdminData(admin);
          setManagerData(manager);
          setEmployeeData(employee);
        } else if (isManager) {
          const [manager, employee] = await Promise.all([
            dashboardApi.getManagerDashboard(),
            dashboardApi.getEmployeeDashboard(),
          ]);
          setManagerData(manager);
          setEmployeeData(employee);
        } else {
          const employee = await dashboardApi.getEmployeeDashboard();
          setEmployeeData(employee);
        }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-amber-400';
      case 'medium': return 'text-sky-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed': return 'bg-green-500/20 text-green-400';
      case 'in_progress': return 'bg-amber-500/20 text-amber-400';
      case 'qa': return 'bg-purple-500/20 text-purple-400';
      case 'reopened': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, <span className="gradient-text">{user?.first_name}</span>
            </h1>
            <p className="text-slate-400">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' '}&bull;{' '}
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              isAdmin ? 'bg-red-500/20 text-red-400' :
              isManager ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
        </div>
      ) : (
        <>
          {/* Employee Dashboard Section */}
          {employeeData && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Work
              </h2>
              
              {/* Employee Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Assigned Tickets</p>
                  <p className="text-3xl font-bold text-white mt-2">{employeeData.assigned_tickets_count}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">In Progress</p>
                  <p className="text-3xl font-bold text-amber-400 mt-2">{employeeData.in_progress_count}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Completed</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">{employeeData.completed_tickets_count}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Time Logged</p>
                  <p className="text-3xl font-bold text-sky-400 mt-2">{employeeData.total_time_logged_hours}h</p>
                </div>
              </div>

              {/* Active Session Alert */}
              {employeeData.active_session && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-amber-400 font-medium">Active Work Session</p>
                      <p className="text-slate-400 text-sm">
                        Working on {employeeData.active_session.ticket_id}: {employeeData.active_session.ticket_title}
                      </p>
                    </div>
                  </div>
                  <Link 
                    href={`/protected/dashboard/tickets/${employeeData.active_session.ticket_id}`}
                    className="text-amber-400 hover:text-amber-300 text-sm font-medium"
                  >
                    View Ticket →
                  </Link>
                </div>
              )}

              {/* In Progress Tickets */}
              {employeeData.in_progress_tickets.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-6">
                  <div className="p-4 border-b border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white">In Progress</h3>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {employeeData.in_progress_tickets.map((ticket) => (
                      <Link 
                        key={ticket.id}
                        href={`/protected/dashboard/tickets/${ticket.id}`}
                        className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                      >
                        <div>
                          <p className="text-white font-medium">{ticket.ticket_id}: {ticket.title}</p>
                          <p className="text-sm text-slate-400">
                            {ticket.project_name} &bull; Priority: <span className={getPriorityColor(ticket.priority)}>{ticket.priority}</span>
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manager Dashboard Section */}
          {managerData && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Project Overview
              </h2>

              {/* Manager Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Projects</p>
                  <p className="text-3xl font-bold text-white mt-2">{managerData.total_projects}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Active</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">{managerData.active_projects}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Tickets</p>
                  <p className="text-3xl font-bold text-sky-400 mt-2">{managerData.total_tickets}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Unassigned</p>
                  <p className="text-3xl font-bold text-red-400 mt-2">{managerData.unassigned_tickets}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Archived</p>
                  <p className="text-3xl font-bold text-slate-400 mt-2">{managerData.archived_projects}</p>
                </div>
              </div>

              {/* Ticket Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Tickets by Status</h3>
                  <div className="space-y-3">
                    {Object.entries(managerData.tickets_by_status).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-slate-300 capitalize">{status.replace('_', ' ')}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-slate-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${getStatusColor(status).split(' ')[0].replace('/20', '')}`}
                              style={{ width: `${managerData.total_tickets ? (count / managerData.total_tickets) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-white font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Project Time Summary</h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {managerData.project_time_data.map((project) => (
                      <div key={project.project_id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{project.project_name}</p>
                          <p className="text-xs text-slate-400">{project.ticket_count} tickets</p>
                        </div>
                        <span className="text-sky-400 font-medium">{project.total_hours}h</span>
                      </div>
                    ))}
                    {managerData.project_time_data.length === 0 && (
                      <p className="text-slate-400 text-center py-4">No time data yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Tickets */}
              {managerData.recent_tickets.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Recent Tickets</h3>
                    <Link href="/protected/dashboard/tickets" className="text-sm text-sky-400 hover:text-sky-300">
                      View All
                    </Link>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {managerData.recent_tickets.slice(0, 5).map((ticket) => (
                      <Link 
                        key={ticket.id}
                        href={`/protected/dashboard/tickets/${ticket.id}`}
                        className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                      >
                        <div>
                          <p className="text-white font-medium">{ticket.ticket_id}: {ticket.title}</p>
                          <p className="text-sm text-slate-400">
                            {ticket.project_name} &bull; {ticket.assignee_name}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Dashboard Section */}
          {adminData && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                System Overview
              </h2>

              {/* Admin Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-white mt-2">{adminData.users.total}</p>
                  <p className="text-xs text-green-400 mt-1">+{adminData.users.recent} this week</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Projects</p>
                  <p className="text-3xl font-bold text-sky-400 mt-2">{adminData.projects.total}</p>
                  <p className="text-xs text-slate-400 mt-1">{adminData.projects.active} active</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Tickets</p>
                  <p className="text-3xl font-bold text-amber-400 mt-2">{adminData.tickets.total}</p>
                  <p className="text-xs text-slate-400 mt-1">+{adminData.tickets.recent} this week</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-400 text-sm">Total Time Logged</p>
                  <p className="text-3xl font-bold text-violet-400 mt-2">{adminData.work_logs.total_hours}h</p>
                  <p className="text-xs text-slate-400 mt-1">{adminData.work_logs.total} work logs</p>
                </div>
              </div>

              {/* User Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Users by Role</h3>
                  <div className="space-y-3">
                    {Object.entries(adminData.users.by_role).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            role === 'admin' ? 'bg-red-400' :
                            role === 'manager' ? 'bg-amber-400' : 'bg-green-400'
                          }`}></div>
                          <span className="text-slate-300 capitalize">{role}s</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-slate-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                role === 'admin' ? 'bg-red-400' :
                                role === 'manager' ? 'bg-amber-400' : 'bg-green-400'
                              }`}
                              style={{ width: `${adminData.users.total ? (count / adminData.users.total) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-white font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {Object.entries(adminData.activity.by_type).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <span className="text-slate-300 capitalize">{action.replace('_', ' ')}</span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm mt-4">
                    {adminData.activity.recent_count} activities in the last 7 days
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link 
                href="/protected/dashboard/projects"
                className="flex items-center gap-3 p-4 rounded-lg bg-slate-700/30 hover:bg-sky-500/10 border border-slate-700/50 hover:border-sky-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Projects</p>
                  <p className="text-xs text-slate-400">Manage projects</p>
                </div>
              </Link>

              <Link 
                href="/protected/dashboard/tickets"
                className="flex items-center gap-3 p-4 rounded-lg bg-slate-700/30 hover:bg-amber-500/10 border border-slate-700/50 hover:border-amber-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Tickets</p>
                  <p className="text-xs text-slate-400">Track tickets</p>
                </div>
              </Link>

              {isAdmin && (
                <Link 
                  href="/protected/dashboard/users"
                  className="flex items-center gap-3 p-4 rounded-lg bg-slate-700/30 hover:bg-violet-500/10 border border-slate-700/50 hover:border-violet-500/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Users</p>
                    <p className="text-xs text-slate-400">Manage users</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
