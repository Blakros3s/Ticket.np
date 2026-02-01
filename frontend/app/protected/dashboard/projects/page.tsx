'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'archived',
  });

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsApi.getProjects();
      setProjects(data);
    } catch (error) {
      showToastMessage('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setAllUsers(data);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  useEffect(() => {
    fetchProjects();
    if (isManager) {
      fetchUsers();
    }
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectsApi.createProject(newProject);
      showToastMessage('Project created successfully', 'success');
      setShowAddModal(false);
      setNewProject({ name: '', description: '', status: 'active' });
      fetchProjects();
    } catch (error) {
      showToastMessage('Failed to create project', 'error');
    }
  };

  const filteredProjects = projects.filter(project => {
    const query = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query)
    );
  });

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const archivedProjects = projects.filter(p => p.status === 'archived').length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Projects</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Projects</h1>
        <p className="text-slate-400 mt-1">Manage your projects and team members</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Projects</p>
              <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Active</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{activeProjects}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Archived</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{archivedProjects}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            className="input-field w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isManager && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-slate-400">No projects found</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/protected/dashboard/projects/${project.id}`}
              className="group bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 hover:border-sky-500/50 hover:bg-slate-800/80 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{project.name.charAt(0).toUpperCase()}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  project.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {project.status === 'active' ? 'Active' : 'Archived'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-sky-400 transition-colors">
                {project.name}
              </h3>
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description || 'No description'}</p>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {project.member_count} members
                </div>
                <span className="text-slate-500">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Create New Project</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  className="input-field w-full"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="input-field w-full resize-none"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Enter project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select
                  className="input-field w-full"
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value as 'active' | 'archived' })}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
