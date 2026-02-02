'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, usersData] = await Promise.all([
          projectsApi.getProjects(),
          isAdmin ? authApi.getUsers() : Promise.resolve([]),
        ]);
        setProjects(projectsData);
        setUsers(usersData);
      } catch (error) {
        console.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  // Ensure projects is always an array
  const projectsList = Array.isArray(projects) ? projects : [];
  
  const activeProjects = projectsList.filter(p => p.status === 'active').length;
  const archivedProjects = projectsList.filter(p => p.status === 'archived').length;
  const totalMembers = projectsList.reduce((acc, p) => acc + p.member_count, 0);

  const recentProjects = projectsList.slice(0, 3);
  const adminUsers = users.filter(u => u.role === 'admin').length;
  const managerUsers = users.filter(u => u.role === 'manager').length;
  const employeeUsers = users.filter(u => u.role === 'employee').length;

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
              {' '}&bull;{' '}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-green-400">System Online</span>
              </span>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Projects</p>
              <p className="text-2xl font-bold text-white mt-1">{projectsList.length}</p>
              <p className="text-xs text-slate-500 mt-1">{activeProjects} active</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-green-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Team Members</p>
              <p className="text-2xl font-bold text-white mt-1">{totalMembers}</p>
              <p className="text-xs text-slate-500 mt-1">Across all projects</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-violet-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">System Users</p>
                <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
                <p className="text-xs text-slate-500 mt-1">{adminUsers} admins, {managerUsers} managers</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Quick Actions</p>
              <p className="text-lg font-semibold text-white mt-1">Get Started</p>
              <p className="text-xs text-slate-500 mt-1">Manage your work</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Your Projects</h2>
                    <p className="text-sm text-slate-400">Recent project activity</p>
                  </div>
                </div>
                <Link 
                  href="/protected/dashboard/projects" 
                  className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  View All
                </Link>
              </div>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-slate-400 mb-4">No projects yet</p>
                {(isAdmin || isManager) && (
                  <Link href="/protected/dashboard/projects" className="btn-primary text-sm">
                    Create Your First Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {recentProjects.map((project) => (
                  <Link 
                    key={project.id}
                    href={`/protected/dashboard/projects/${project.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-bold">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{project.name}</p>
                        <p className="text-sm text-slate-400">
                          {project.member_count} members • {project.status === 'active' ? 'Active' : 'Archived'}
                        </p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed Placeholder */}
          <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
                <p className="text-sm text-slate-400">Coming soon</p>
              </div>
            </div>
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-slate-400">Activity tracking will be available soon</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
            <div className="space-y-3">
              <Link 
                href="/protected/dashboard/projects"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-sky-500/10 border border-slate-700/50 hover:border-sky-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Projects</p>
                  <p className="text-xs text-slate-400">Manage your projects</p>
                </div>
              </Link>

              {isAdmin && (
                <Link 
                  href="/protected/dashboard/users"
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-violet-500/10 border border-slate-700/50 hover:border-violet-500/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">User Management</p>
                    <p className="text-xs text-slate-400">Manage system users</p>
                  </div>
                </Link>
              )}

              <Link 
                href="/protected/dashboard/tickets"
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-amber-500/10 border border-slate-700/50 hover:border-amber-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Tickets</p>
                  <p className="text-xs text-slate-400">Track issues & tasks</p>
                </div>
              </Link>
            </div>
          </div>

          {/* User Breakdown (Admin only) */}
          {isAdmin && !loading && users.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">User Distribution</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span className="text-slate-300 text-sm">Administrators</span>
                  </div>
                  <span className="text-white font-medium">{adminUsers}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-red-400 h-2 rounded-full" style={{ width: `${(adminUsers / users.length) * 100}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <span className="text-slate-300 text-sm">Managers</span>
                  </div>
                  <span className="text-white font-medium">{managerUsers}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${(managerUsers / users.length) * 100}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="text-slate-300 text-sm">Employees</span>
                  </div>
                  <span className="text-white font-medium">{employeeUsers}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: `${(employeeUsers / users.length) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">API Server</span>
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Database</span>
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Authentication</span>
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
