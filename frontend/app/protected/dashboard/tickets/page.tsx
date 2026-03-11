'use client';

import React from 'react';
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
  }, [priorityFilter, typeFilter, projectFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Filter tickets by selected status tab (client-side)
  const displayedTickets = statusFilter
    ? tickets.filter(t => t.status === statusFilter)
    : tickets;

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
    qa: tickets.filter(t => t.status === 'qa').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    reopened: tickets.filter(t => t.status === 'reopened').length,
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

      {/* Search and New Ticket */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
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
          {projects.length > 0 && (
            <Link
              href="/protected/dashboard/tickets/new"
              className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg whitespace-nowrap font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Ticket
            </Link>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['', 'new', 'in_progress', 'qa', 'closed', 'reopened'] as const).map((status) => {
          const label = status === '' ? 'All' : status.replace('_', ' ');
          const count = status === '' ? stats.total : status === 'in_progress' ? stats.inProgress : stats[status as keyof typeof stats] ?? 0;
          const isActive = statusFilter === status;
          const activeStyles: Record<string, React.CSSProperties> = {
            '': { backgroundColor: 'rgba(71, 85, 105, 0.4)', color: 'rgb(148, 163, 184)', borderColor: 'rgba(71, 85, 105, 0.5)' },
            new: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'rgb(96, 165, 250)', borderColor: 'rgba(59, 130, 246, 0.4)' },
            in_progress: { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'rgb(251, 191, 36)', borderColor: 'rgba(245, 158, 11, 0.4)' },
            qa: { backgroundColor: 'rgba(168, 85, 247, 0.2)', color: 'rgb(192, 132, 252)', borderColor: 'rgba(168, 85, 247, 0.4)' },
            closed: { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: 'rgb(74, 222, 128)', borderColor: 'rgba(34, 197, 94, 0.4)' },
            reopened: { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'rgb(248, 113, 113)', borderColor: 'rgba(239, 68, 68, 0.4)' },
          };
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all border ${
                isActive ? '' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
              }`}
              style={isActive ? activeStyles[status] : {}}
            >
              {label.charAt(0).toUpperCase() + label.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Additional Filters */}
      <div className="filter-bar mb-6">
        <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {/* Tickets List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
          </div>
        ) : displayedTickets.length === 0 ? (
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
                {displayedTickets.map((ticket) => (
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
                      {ticket.assignees_list && ticket.assignees_list.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ticket.assignees_list.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-medium text-sky-400">
                                  {(a.display_name || a.username).slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs text-white truncate max-w-[80px]" title={a.display_name || a.username}>
                                {a.display_name || a.username}
                              </span>
                            </div>
                          ))}
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
