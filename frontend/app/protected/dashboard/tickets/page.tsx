'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ticketsApi, Ticket, TicketStatus, TicketPriority, TicketType } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';

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

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('');
  const [projectFilter, setProjectFilter] = useState<number | ''>('');

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsData, projectsData] = await Promise.all([
        ticketsApi.getTickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          type: typeFilter || undefined,
          project: projectFilter || undefined,
          search: searchQuery || undefined,
        }),
        projectsApi.getProjects(),
      ]);
      setTickets(ticketsData);
      setProjects(projectsData);
    } catch (error) {
      showToastMessage('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, typeFilter, projectFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setTypeFilter('');
    setProjectFilter('');
  };

  const stats = {
    total: tickets.length,
    new: tickets.filter(t => t.status === 'new').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white">Dashboard</Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Tickets</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Tickets</h1>
        <p className="text-slate-400 mt-1">Track and manage issues, tasks, and features</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm">New</p>
          <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-amber-400">{stats.inProgress}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-slate-400 text-sm">Closed</p>
          <p className="text-2xl font-bold text-green-400">{stats.closed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 search-input flex items-center">
            <div className="pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search tickets by title, ID, or description..."
              className="w-full bg-transparent border-0 pl-3 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="pr-4 text-slate-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="input-field min-w-[130px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus)}
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="qa">QA</option>
              <option value="closed">Closed</option>
              <option value="reopened">Reopened</option>
            </select>

            <select
              className="input-field min-w-[130px]"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority)}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              className="input-field min-w-[120px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TicketType)}
            >
              <option value="">All Types</option>
              <option value="bug">Bug</option>
              <option value="task">Task</option>
              <option value="feature">Feature</option>
            </select>

            <select
              className="input-field min-w-[140px]"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {(statusFilter || priorityFilter || typeFilter || projectFilter || searchQuery) && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>

          {/* Allow all users to create tickets - backend validates project access */}
          {projects.length > 0 && (
            <Link
              href="/protected/dashboard/tickets/new"
              className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg whitespace-nowrap font-medium relative overflow-hidden"
            >
              <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="relative z-10">New Ticket</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-slate-400">No tickets found</p>
            {projects.length > 0 && (
              <Link href="/protected/dashboard/tickets/new" className="btn-primary mt-4 inline-block">
                Create First Ticket
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Assignee</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Project</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/protected/dashboard/tickets/${ticket.id}`} className="block">
                        <p className="text-sm font-medium text-white hover:text-sky-400 transition-colors">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-slate-500">{ticket.ticket_id}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[ticket.priority]}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300 capitalize">{ticket.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      {ticket.assignee_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-sky-400">
                              {ticket.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm text-white truncate">{ticket.assignee_name}</span>
                            {ticket.assignee_username && (
                              <span className="text-xs text-slate-500">@{ticket.assignee_username}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">{ticket.project_name}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
