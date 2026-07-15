'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { projectsApi, Project } from '@/lib/projects';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    github_repo: '',
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
    } catch {
      showToastMessage('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectsApi.createProject(newProject);
      showToastMessage('Project created successfully', 'success');
      setShowAddModal(false);
      setNewProject({ name: '', description: '', github_repo: '', status: 'active' });
      fetchProjects();
    } catch {
      showToastMessage('Failed to create project', 'error');
    }
  };

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query)
    );
  });

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const archivedProjects = projects.filter((p) => p.status === 'archived').length;

  return (
    <div className="page-container">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.message}
        </div>
      )}

      <header className="page-header">
        <nav className="breadcrumb">
          <Link href="/protected/dashboard">Dashboard</Link>
          <span className="breadcrumb-sep">/</span>
          <span>Projects</span>
        </nav>
        <h1 className="page-title">Projects</h1>
        <p className="page-subtitle">Manage your projects and team members</p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-label">Total Projects</p>
              <p className="stat-card-value">{projects.length}</p>
            </div>
            <div className="stat-card-icon">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-label">Active</p>
              <p className="stat-card-value" style={{ color: 'var(--success)' }}>{activeProjects}</p>
            </div>
            <div className="stat-card-icon">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-label">Archived</p>
              <p className="stat-card-value" style={{ color: 'var(--warning)' }}>{archivedProjects}</p>
            </div>
            <div className="stat-card-icon">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative w-full sm:max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            className="input-field pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isManager && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-4 py-2.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        )}
      </div>

      <div className="project-grid">
        {loading ? (
          <div className="col-span-full empty-state">
            <div
              className="animate-spin rounded-full h-8 w-8 border-2 mx-auto mb-4"
              style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--accent)' }}
            />
            <p>Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full empty-state">
            <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p>No projects found</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <Link key={project.id} href={`/protected/dashboard/projects/${project.id}`} className="project-card">
              <div className="flex items-start justify-between mb-4">
                <div className="project-card-avatar">
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <span className={`badge ${project.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {project.status === 'active' ? 'Active' : 'Archived'}
                </span>
              </div>
              <h3 className="project-card-title">{project.name}</h3>
              <p className="project-card-desc mb-4">{project.description || 'No description'}</p>
              <div className="flex items-center justify-between meta-text">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {project.member_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    {project.ticket_count || 0}
                  </span>
                </div>
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button onClick={() => setShowAddModal(false)} className="icon-btn" type="button">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="modal-body space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Project Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  rows={3}
                  className="input-field resize-none"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Enter project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>GitHub Repository</label>
                <input
                  type="url"
                  className="input-field"
                  value={newProject.github_repo}
                  onChange={(e) => setNewProject({ ...newProject, github_repo: e.target.value })}
                  placeholder="https://github.com/username/repo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <select
                  className="input-field"
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value as 'active' | 'archived' })}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="modal-footer -mx-6 -mb-6 mt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 py-2.5">
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
