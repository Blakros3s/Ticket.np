'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
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
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<CreateTicketData>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    project: 0,
    assignee: null,
    media_files: [],
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

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaPreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.project) {
      showToastMessage('Please select a project', 'error');
      return;
    }

    try {
      setLoading(true);
      const ticketData = {
        ...formData,
        media_files: mediaFiles,
      };
      const ticket = await ticketsApi.createTicket(ticketData);
      showToastMessage('Ticket created successfully', 'success');

      setTimeout(() => {
        window.location.href = `/protected/dashboard/tickets/${ticket.id}`;
      }, 500);
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to create ticket', 'error');
      setLoading(false);
    }
  };

  const selectedProject = projects.find(p => p.id === formData.project);
  const projectMembers = selectedProject?.members.map(m => m.user) || [];

  if (fetchingData) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-700/30 rounded w-1/3"></div>
          <div className="h-96 bg-slate-700/30 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="form-card p-12 text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Projects Available</h2>
          <p className="text-slate-400 mb-6">You need to be a member of a project to create tickets.</p>
          <Link href="/protected/dashboard/projects" className="btn-primary px-6 py-2.5">
            View Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white text-sm">Dashboard</Link>
        <span className="text-slate-600">/</span>
        <Link href="/protected/dashboard/tickets" className="text-slate-400 hover:text-white text-sm">Tickets</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white text-sm font-medium">New Ticket</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create New Ticket</h1>
        <p className="text-slate-400 mt-1">Fill in the details to create a new ticket</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Project <span className="text-red-400">*</span>
            </label>
            <select
              required
              className="input-field w-full"
              value={formData.project}
              onChange={(e) => setFormData({ ...formData, project: Number(e.target.value), assignee: null })}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
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

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
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
            <p className="text-xs text-slate-500 mt-1">Supports Markdown: **bold**, *italic*, `code`, [links](url)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
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

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Assignee
            </label>
            <select
              className="input-field w-full"
              value={formData.assignee || ''}
              onChange={(e) => setFormData({ ...formData, assignee: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Unassigned - Can self-assign</option>
              {projectMembers.length > 0 ? (
                projectMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name} (@{member.username})
                  </option>
                ))
              ) : (
                users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} (@{u.username})
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Leave unassigned to allow team members to self-assign
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Attachments
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md"
              onChange={handleMediaChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 hover:border-sky-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
            >
              <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-slate-400 text-sm">Click to upload files or drag and drop</p>
              <p className="text-slate-500 text-xs mt-1">Images, videos, PDF, documents</p>
            </div>

            {mediaPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {mediaPreviews.map((preview, index) => (
                  <div key={index} className="relative group w-full h-24">
                    <Image src={preview} alt="" fill className="object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/protected/dashboard/tickets"
            className="flex-1 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-all text-center font-medium border border-slate-600/50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 btn-primary px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
