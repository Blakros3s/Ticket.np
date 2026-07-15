'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { ticketsApi, TicketType, TicketPriority, CreateTicketData } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';
import { FileUploadZone } from '@/components/file-upload-zone';

function CreateTicketForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('project') ? Number(searchParams.get('project')) : 0;
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<CreateTicketData>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    project: initialProjectId,
    assignees: [],
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

        if (projectsData.length > 0 && !initialProjectId) {
          setFormData(prev => ({ ...prev, project: projectsData[0].id }));
        } else if (initialProjectId) {
          setFormData(prev => ({ ...prev, project: initialProjectId }));
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

      if (ticket?.id) {
        await router.push(`/protected/dashboard/tickets/${ticket.id}`);
      }
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to create ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find(p => p.id === formData.project);
  const projectMembers = selectedProject?.members.map(m => m.user) || [];
  const assigneePool = projectMembers.length > 0 ? projectMembers : users;

  const filteredAssignees = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();
    if (!query) return assigneePool;

    return assigneePool.filter((member) => {
      const fullName = `${member.first_name} ${member.last_name}`.trim().toLowerCase();
      return (
        fullName.includes(query) ||
        member.username.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        (member.login_address?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [assigneePool, assigneeSearch]);

  const getMemberDisplayName = (member: User) => {
    const fullName = `${member.first_name} ${member.last_name}`.trim();
    return fullName || member.username;
  };

  const toggleAssignee = (memberId: number, checked: boolean) => {
    const ids = formData.assignees || [];
    if (checked) {
      setFormData({ ...formData, assignees: [...ids, memberId] });
    } else {
      setFormData({ ...formData, assignees: ids.filter((id) => id !== memberId) });
    }
  };

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
        <h1 className="page-title text-3xl font-bold">Create New Ticket</h1>
        <p className="page-subtitle mt-1">Fill in the details to create a new ticket</p>
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
              onChange={(e) => {
                setFormData({ ...formData, project: Number(e.target.value), assignees: [] });
                setAssigneeSearch('');
              }}
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
            <p className="text-xs text-slate-500 mt-1">Supports Markdown: **bold**, *italic*, `code`, [links](url). Line breaks are preserved when pasted.</p>
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
              Assignees (optional)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Search project members by name or username. Leave empty to allow self-assign.
            </p>

            {formData.assignees && formData.assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.assignees.map((id) => {
                  const member = assigneePool.find((m) => m.id === id);
                  if (!member) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm bg-sky-500/15 text-sky-300 border border-sky-500/25"
                    >
                      {getMemberDisplayName(member)}
                      <button
                        type="button"
                        onClick={() => toggleAssignee(id, false)}
                        className="text-sky-400/80 hover:text-white"
                        aria-label={`Remove ${getMemberDisplayName(member)}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="search-input flex items-center mb-2">
              <div className="pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name or username..."
                className="w-full bg-transparent border-0 pl-2 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-0"
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
              />
              {assigneeSearch && (
                <button
                  type="button"
                  onClick={() => setAssigneeSearch('')}
                  className="pr-3 text-slate-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="assignee-picker-list border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
              {assigneePool.length === 0 ? (
                <p className="text-sm text-slate-500 px-3 py-4 text-center">No project members available</p>
              ) : filteredAssignees.length === 0 ? (
                <p className="text-sm text-slate-500 px-3 py-4 text-center">No members match &ldquo;{assigneeSearch}&rdquo;</p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {filteredAssignees.map((member) => {
                    const isSelected = formData.assignees?.includes(member.id) ?? false;
                    const displayName = getMemberDisplayName(member);
                    const initials =
                      member.first_name && member.last_name
                        ? `${member.first_name[0]}${member.last_name[0]}`.toUpperCase()
                        : member.username.slice(0, 2).toUpperCase();

                    return (
                      <label
                        key={member.id}
                        className={`assignee-picker-row flex items-center gap-3 cursor-pointer px-3 py-2.5 ${
                          isSelected ? 'assignee-picker-row--selected' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleAssignee(member.id, e.target.checked)}
                          className="rounded border-slate-500 shrink-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-sky-400">{initials}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-200 truncate">{displayName}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {member.login_address || member.username}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Attachments
            </label>
            <FileUploadZone
              onFilesSelected={(files) => {
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
              }}
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md"
              className="bg-slate-700/30"
            />

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

export default function CreateTicketPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-16 h-16 border-4 border-slate-700 rounded-full border-t-sky-500 animate-spin"></div>
      </div>
    }>
      <CreateTicketForm />
    </Suspense>
  );
}
