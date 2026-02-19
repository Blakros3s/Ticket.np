'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ticketsApi, TicketType, TicketPriority, CreateTicketData } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';

export default function CreateTicketPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState<CreateTicketData>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    project: 0,
    assignee: null,
  });

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, usersData] = await Promise.all([
          projectsApi.getProjects(),
          authApi.getUsers(),
        ]);
        setProjects(projectsData);
        setUsers(usersData.filter(u => u.is_active));
        
        // Set default project if available
        if (projectsData.length > 0) {
          setFormData(prev => ({ ...prev, project: projectsData[0].id }));
        }
      } catch (error) {
        showToastMessage('Failed to load data', 'error');
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project) {
      showToastMessage('Please select a project', 'error');
      return;
    }

    try {
      setLoading(true);
      const ticket = await ticketsApi.createTicket(formData);
      showToastMessage('Ticket created successfully', 'success');
      
      // Redirect to the new ticket after short delay
      setTimeout(() => {
        window.location.href = `/protected/dashboard/tickets/${ticket.id}`;
      }, 500);
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to create ticket', 'error');
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-white mb-4">No Projects Available</h1>
          <p className="text-slate-400 mb-6">You need to be a member of a project to create tickets.</p>
          <Link href="/protected/dashboard/projects" className="btn-primary">
            View Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white">Dashboard</Link>
        <span className="text-slate-500">/</span>
        <Link href="/protected/dashboard/tickets" className="text-slate-400 hover:text-white">Tickets</Link>
        <span className="text-slate-500">/</span>
        <span className="text-white">New Ticket</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create New Ticket</h1>
        <p className="text-slate-400">Fill in the details below to create a new ticket</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card p-8 space-y-6">
        {/* Project Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Project <span className="text-red-400">*</span>
          </label>
          <select
            required
            className="input-field w-full"
            value={formData.project}
            onChange={(e) => setFormData({ ...formData, project: Number(e.target.value) })}
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            You can only create tickets in projects you are a member of
          </p>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            className="input-field w-full"
            placeholder="Enter a clear, descriptive title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={6}
            required
            className="input-field w-full resize-none"
            placeholder="Describe the issue or task in detail. Markdown is supported."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <p className="text-xs text-slate-500">
            Supports Markdown: **bold**, *italic*, `code`, [links](url), and more
          </p>
        </div>

        {/* Type and Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              required
              className="input-field w-full"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as TicketType })}
            >
              <option value="bug">Bug</option>
              <option value="task">Task</option>
              <option value="feature">Feature</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Priority <span className="text-red-400">*</span>
            </label>
            <select
              required
              className="input-field w-full"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Assignee
          </label>
          <select
            className="input-field w-full"
            value={formData.assignee || ''}
            onChange={(e) => setFormData({ ...formData, assignee: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.username}) - {user.role}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Leave empty to allow team members to self-assign
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700/50 pt-6">
          {/* Actions */}
          <div className="flex gap-4">
            <Link
              href="/protected/dashboard/tickets"
              className="flex-1 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-all text-center font-medium border border-slate-600/50 hover:border-slate-600"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary px-4 py-3 rounded-lg disabled:opacity-50 font-medium relative overflow-hidden"
            >
              <span className="relative z-10">{loading ? 'Creating...' : 'Create Ticket'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
