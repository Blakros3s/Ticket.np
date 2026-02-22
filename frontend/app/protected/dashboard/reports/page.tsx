'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dashboardApi, EmployeeReports, ManagerReports, AdminReports } from '@/lib/dashboard';

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  
  const [employeeReports, setEmployeeReports] = useState<EmployeeReports | null>(null);
  const [managerReports, setManagerReports] = useState<ManagerReports | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReports | null>(null);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isAdmin) {
          console.log('Fetching admin reports...');
          const [admin, manager, employee] = await Promise.all([
            dashboardApi.getAdminReports(period),
            dashboardApi.getManagerReports(period),
            dashboardApi.getEmployeeReports(period),
          ]);
          console.log('Admin reports:', admin);
          console.log('Manager reports:', manager);
          console.log('Employee reports:', employee);
          setAdminReports(admin);
          setManagerReports(manager);
          setEmployeeReports(employee);
        } else if (isManager) {
          console.log('Fetching manager reports...');
          const [manager, employee] = await Promise.all([
            dashboardApi.getManagerReports(period),
            dashboardApi.getEmployeeReports(period),
          ]);
          console.log('Manager reports:', manager);
          console.log('Employee reports:', employee);
          setManagerReports(manager);
          setEmployeeReports(employee);
        } else {
          console.log('Fetching employee reports...');
          const employee = await dashboardApi.getEmployeeReports(period);
          console.log('Employee reports:', employee);
          setEmployeeReports(employee);
        }
      } catch (error: any) {
        console.error('Failed to load reports:', error);
        console.error('Error response:', error.response);
        setError(error.response?.data?.error || error.message || 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchReports();
    }
  }, [user, period, isAdmin, isManager]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-sky-500';
      default: return 'bg-slate-500';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-sky-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-slate-500">/</span>
            <span className="text-white">Reports & Analytics</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-slate-400 mt-1">Detailed insights and performance metrics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="space-y-8">
        {adminReports && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              System Overview (Admin)
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white mt-1">{adminReports.summary.total_users}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Total Projects</p>
                <p className="text-2xl font-bold text-white mt-1">{adminReports.summary.total_projects}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Total Tickets</p>
                <p className="text-2xl font-bold text-white mt-1">{adminReports.summary.total_tickets}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Total Hours Logged</p>
                <p className="text-2xl font-bold text-sky-400 mt-1">{adminReports.summary.total_hours_logged}h</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Ticket Volume Trend</h3>
                <div className="space-y-2">
                  {adminReports.ticket_volume_trend.slice(-7).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-700/30">
                      <span className="text-slate-400 text-sm">{item.date}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sky-400 text-sm">+{item.created} created</span>
                        <span className="text-green-400 text-sm">-{item.closed} closed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Top Performers</h3>
                <div className="space-y-3">
                  {adminReports.top_performers.slice(0, 5).map((performer, idx) => (
                    <div key={performer.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-bold w-6">#{idx + 1}</span>
                        <span className="text-white">{performer.user_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-400">{performer.tickets_closed} closed</span>
                        <span className="text-slate-400">{performer.total_hours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Project Health</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 text-sm font-medium py-2">Project</th>
                      <th className="text-center text-slate-400 text-sm font-medium py-2">Tickets</th>
                      <th className="text-center text-slate-400 text-sm font-medium py-2">Open</th>
                      <th className="text-center text-slate-400 text-sm font-medium py-2">Overdue</th>
                      <th className="text-center text-slate-400 text-sm font-medium py-2">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminReports.project_health.map((project) => (
                      <tr key={project.project_id} className="border-b border-slate-700/30">
                        <td className="py-3 text-white">{project.project_name}</td>
                        <td className="py-3 text-center text-slate-300">{project.total_tickets}</td>
                        <td className="py-3 text-center text-amber-400">{project.open_tickets}</td>
                        <td className="py-3 text-center text-red-400">{project.overdue}</td>
                        <td className="py-3 text-center">
                          <span className={`font-bold ${getHealthColor(project.health_score)}`}>
                            {project.health_score}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {managerReports && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Team Performance
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Team Members</h3>
                <div className="space-y-3">
                  {managerReports.team_performance.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{member.user_name}</p>
                        <p className="text-xs text-slate-400">{member.total_hours}h logged</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-amber-400 font-medium">{member.in_progress}</p>
                          <p className="text-slate-500 text-xs">In Progress</p>
                        </div>
                        <div className="text-center">
                          <p className="text-green-400 font-medium">{member.completed}</p>
                          <p className="text-slate-500 text-xs">Completed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Project Progress</h3>
                <div className="space-y-4">
                  {managerReports.project_progress.map((project) => (
                    <div key={project.project_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm">{project.project_name}</span>
                        <span className="text-slate-400 text-sm">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-sky-500 to-violet-500 h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{project.completed} of {project.total_tickets} tickets completed</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Avg Resolution Time by Priority</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {managerReports.resolution_by_priority.map((item) => (
                  <div key={item.priority} className="bg-slate-700/30 rounded-lg p-4 text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${getPriorityColor(item.priority)}`} />
                    <p className="text-white font-medium capitalize">{item.priority}</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{item.avg_hours}h</p>
                    <p className="text-xs text-slate-500">{item.count} tickets</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {employeeReports && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Performance
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Assigned Tickets</p>
                <p className="text-2xl font-bold text-white mt-1">{employeeReports.productivity.total_assigned}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{employeeReports.productivity.total_completed}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Completion Rate</p>
                <p className="text-2xl font-bold text-sky-400 mt-1">{employeeReports.productivity.completion_rate}%</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Avg Resolution</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{employeeReports.productivity.avg_resolution_hours}h</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Time Logged by Project</h3>
                {employeeReports.time_by_project.length > 0 ? (
                  <div className="space-y-3">
                    {employeeReports.time_by_project.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-white">{item.project_name}</p>
                          <p className="text-xs text-slate-500">{item.session_count} work sessions</p>
                        </div>
                        <span className="text-sky-400 font-bold">{item.total_hours}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">No time logged yet</p>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Priority Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(employeeReports.priority_distribution).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`} />
                        <span className="text-slate-300 capitalize">{priority}</span>
                      </div>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Daily Time Trend (Last 14 Days)</h3>
              <div className="flex items-end gap-1 h-32">
                {employeeReports.time_trend.map((item, idx) => {
                  const maxHours = Math.max(...employeeReports.time_trend.map(t => t.hours), 1);
                  const height = (item.hours / maxHours) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-sky-500 to-violet-500 rounded-t transition-all hover:from-sky-400 hover:to-violet-400"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${item.date}: ${item.hours}h`}
                      />
                      {idx % 2 === 0 && (
                        <span className="text-[10px] text-slate-500">{item.date.slice(5)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        
        {!adminReports && !managerReports && !employeeReports && !loading && !error && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No Reports Available</h3>
            <p className="text-slate-400">Start creating tickets and logging time to see your reports.</p>
          </div>
        )}
      </div>
    </div>
  );
}
