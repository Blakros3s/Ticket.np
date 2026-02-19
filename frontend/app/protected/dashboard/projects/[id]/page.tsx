'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';
import { ticketsApi, Ticket, TicketStatus, TicketPriority } from '@/lib/tickets';

const statusColors: Record<TicketStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  qa: 'bg-purple-500/20 text-purple-400',
  closed: 'bg-green-500/20 text-green-400',
  reopened: 'bg-red-500/20 text-red-400',
};

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-slate-500/20 text-slate-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

export default function ProjectDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = Number(params.id);
  
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'archived',
  });

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isCreator = project?.created_by.id === user?.id;

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProject = async () => {
    try {
      setLoading(true);
      const data = await projectsApi.getProject(projectId);
      setProject(data);
      setEditData({
        name: data.name,
        description: data.description,
        status: data.status,
      });
    } catch (error) {
      showToastMessage('Failed to load project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const data = await ticketsApi.getTicketsByProject(projectId);
      setTickets(data);
    } catch (error) {
      console.error('Failed to load tickets');
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const allUsers = await authApi.getUsers();
      // Filter out users who are already members
      const memberIds = project?.members.map(m => m.user.id) || [];
      const available = allUsers.filter(u => !memberIds.includes(u.id) && u.is_active);
      setAvailableUsers(available);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  useEffect(() => {
    fetchProject();
    fetchTickets();
  }, [projectId]);

  useEffect(() => {
    if (showAddMemberModal && project) {
      fetchAvailableUsers();
    }
  }, [showAddMemberModal, project]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      await projectsApi.addMember(projectId, Number(selectedUserId));
      showToastMessage('Member added successfully', 'success');
      setShowAddMemberModal(false);
      setSelectedUserId('');
      fetchProject();
    } catch (error) {
      showToastMessage('Failed to add member', 'error');
    }
  };

  const handleRemoveMember = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from this project?`)) return;

    try {
      await projectsApi.removeMember(projectId, userId);
      showToastMessage('Member removed successfully', 'success');
      fetchProject();
    } catch (error) {
      showToastMessage('Failed to remove member', 'error');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectsApi.updateProject(projectId, editData);
      showToastMessage('Project updated successfully', 'success');
      setShowEditModal(false);
      fetchProject();
    } catch (error) {
      showToastMessage('Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      await projectsApi.deleteProject(projectId);
      showToastMessage('Project deleted successfully', 'success');
      window.location.href = '/protected/dashboard/projects';
    } catch (error) {
      showToastMessage('Failed to delete project', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
          <p className="text-slate-400 mt-4">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-white mb-4">Project Not Found</h1>
          <Link href="/protected/dashboard/projects" className="btn-primary">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-2">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
          Dashboard
        </Link>
        <span className="text-slate-500">/</span>
        <Link href="/protected/dashboard/projects" className="text-slate-400 hover:text-white transition-colors">
          Projects
        </Link>
        <span className="text-slate-500">/</span>
        <span className="text-white">{project.name}</span>
      </div>

      {/* Project Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              project.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {project.status === 'active' ? 'Active' : 'Archived'}
            </span>
          </div>
          <p className="text-slate-400">{project.description || 'No description'}</p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            {isCreator && (
              <button
                onClick={handleDeleteProject}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tickets Section */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Tickets
                <span className="ml-2 text-sm font-normal text-slate-400">({tickets.length})</span>
              </h2>
              <Link 
                href={`/protected/dashboard/tickets/new?project=${projectId}`}
                className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 relative overflow-hidden"
              >
                <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="relative z-10">New Ticket</span>
              </Link>
            </div>
            
            {ticketsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-slate-400 mb-4">No tickets in this project yet</p>
                <Link 
                  href={`/protected/dashboard/tickets/new?project=${projectId}`}
                  className="text-sky-400 hover:text-sky-300 text-sm"
                >
                  Create the first ticket
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 10).map((ticket) => (
                  <Link 
                    key={ticket.id}
                    href={`/protected/dashboard/tickets/${ticket.id}`}
                    className="block p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-600/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500 font-mono">{ticket.ticket_id}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                            {ticket.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <h3 className="text-white font-medium truncate">{ticket.title}</h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className={`inline-flex px-1.5 py-0.5 rounded ${priorityColors[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                          <span className="capitalize">{ticket.type}</span>
                          {ticket.assignee_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {ticket.assignee_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
                {tickets.length > 10 && (
                  <Link 
                    href={`/protected/dashboard/tickets?project=${projectId}`}
                    className="block text-center py-3 text-sky-400 hover:text-sky-300 text-sm"
                  >
                    View all {tickets.length} tickets
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project Info */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Created by</span>
                <span className="text-white">{project.created_by.first_name} {project.created_by.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Created</span>
                <span className="text-white">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Updated</span>
                <span className="text-white">{new Date(project.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Members</span>
                <span className="text-white">{project.member_count}</span>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Team Members</h3>
              {isManager && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="text-sky-400 hover:text-sky-300 text-sm"
                >
                  + Add Member
                </button>
              )}
            </div>
            <div className="space-y-3">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm">
                      {member.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{member.user.first_name} {member.user.last_name}</p>
                      <p className="text-xs text-slate-400">{member.user.username} • {member.user.role}</p>
                    </div>
                  </div>
                  {isManager && member.user.id !== project.created_by.id && (
                    <button
                      onClick={() => handleRemoveMember(member.user.id, member.user.username)}
                      className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
                      title="Remove member"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {project.members.length === 0 && (
                <p className="text-slate-400 text-center py-4">No members yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Add Team Member</h2>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Select User</label>
                <select
                  className="input-field w-full"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  required
                >
                  <option value="">Choose a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.username}) - {user.role}
                    </option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="text-slate-400 text-sm mt-2">No available users to add</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg"
                  disabled={!selectedUserId || availableUsers.length === 0}
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Edit Project</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  className="input-field w-full"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="input-field w-full resize-none"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select
                  className="input-field w-full"
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value as 'active' | 'archived' })}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
