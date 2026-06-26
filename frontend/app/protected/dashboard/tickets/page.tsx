'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function TicketsList() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialProject = searchParams.get('project') ? Number(searchParams.get('project')) : '';
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Pagination & Stats
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    in_progress: 0,
    qa: 0,
    closed: 0,
    reopened: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>('');
  const [projectFilter, setProjectFilter] = useState<number | ''>(initialProject);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      setLoading(true);
      const [ticketsResponse, statsData, projectsData] = await Promise.all([
        ticketsApi.getTickets({
          page,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          type: typeFilter || undefined,
          project: projectFilter || undefined,
          search: searchQuery || undefined,
        }),
        ticketsApi.getTicketStats({
          priority: priorityFilter || undefined,
          type: typeFilter || undefined,
          project: projectFilter || undefined,
          search: searchQuery || undefined,
        }),
        isInitial ? projectsApi.getProjects() : Promise.resolve(projects),
      ]);
      
      setTickets(ticketsResponse.results);
      setTotalCount(ticketsResponse.count);
      setStats(statsData as any);
      if (isInitial) setProjects(projectsData);
    } catch (error) {
      showToastMessage('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, typeFilter, projectFilter, searchQuery, projects]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, typeFilter, projectFilter, searchQuery]);

  // Fetch data on page or filter change (filters trigger setPage(1) which triggers this)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(projects.length === 0);
    }, searchQuery ? 500 : 0);
    
    return () => clearTimeout(timer);
  }, [page, statusFilter, priorityFilter, typeFilter, projectFilter, searchQuery, fetchData, projects.length]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setTypeFilter('');
    setProjectFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / 20);

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
        {(['', 'new', 'in_progress', 'qa', 'closed', 'reopened'] as const).map((statusKey) => {
          const label = statusKey === '' ? 'All' : statusKey.replace('_', ' ');
          const count = statusKey === '' ? stats.total : stats[statusKey as keyof typeof stats] ?? 0;
          const isActive = statusFilter === statusKey;
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
              key={statusKey}
              onClick={() => setStatusFilter(statusKey)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all border ${
                isActive ? '' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
              }`}
              style={isActive ? activeStyles[statusKey] : {}}
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
        {loading && tickets.length === 0 ? (
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Created By</th>
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
                      <span className="text-sm text-slate-300">{ticket.created_by}</span>
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

      {/* Pagination */}
      {totalCount > 20 && (
        <div className="mt-6 flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">
                Showing <span className="font-medium text-white">{(page - 1) * 20 + 1}</span> to{' '}
                <span className="font-medium text-white">{Math.min(page * 20, totalCount)}</span> of{' '}
                <span className="font-medium text-white">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  const isCurrent = p === page;
                  if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold transition-colors ${
                          isCurrent
                            ? 'z-10 bg-sky-500 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500'
                            : 'text-slate-300 ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  }
                  if (p === 2 && page > 3) return <span key="dots1" className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-700">...</span>;
                  if (p === totalPages - 1 && page < totalPages - 2) return <span key="dots2" className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-slate-700">...</span>;
                  return null;
                })}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-16 h-16 border-4 border-slate-700 rounded-full border-t-sky-500 animate-spin"></div>
      </div>
    }>
      <TicketsList />
    </Suspense>
  );
}
