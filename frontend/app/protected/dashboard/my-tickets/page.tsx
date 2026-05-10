'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ticketsApi, Ticket, TicketStatus, TicketPriority, TicketType } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';

const statusColors: Record<TicketStatus, string> = {
  new:         'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  qa:          'bg-purple-500/20 text-purple-400 border-purple-500/30',
  closed:      'bg-green-500/20 text-green-400 border-green-500/30',
  reopened:    'bg-red-500/20 text-red-400 border-red-500/30',
};

const priorityColors: Record<TicketPriority, string> = {
  low:      'bg-slate-500/20 text-slate-400',
  medium:   'bg-blue-500/20 text-blue-400',
  high:     'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const STATUS_TABS: { value: TicketStatus | ''; label: string }[] = [
  { value: '',            label: 'All' },
  { value: 'new',         label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'qa',          label: 'QA' },
  { value: 'closed',      label: 'Closed' },
  { value: 'reopened',    label: 'Reopened' },
];

const TAB_ACTIVE_STYLES: Record<string, React.CSSProperties> = {
  '':           { backgroundColor: 'rgba(71,85,105,0.4)',   color: 'rgb(148,163,184)', borderColor: 'rgba(71,85,105,0.5)' },
  new:          { backgroundColor: 'rgba(59,130,246,0.2)',  color: 'rgb(96,165,250)',  borderColor: 'rgba(59,130,246,0.4)' },
  in_progress:  { backgroundColor: 'rgba(245,158,11,0.2)', color: 'rgb(251,191,36)',  borderColor: 'rgba(245,158,11,0.4)' },
  qa:           { backgroundColor: 'rgba(168,85,247,0.2)', color: 'rgb(192,132,252)', borderColor: 'rgba(168,85,247,0.4)' },
  closed:       { backgroundColor: 'rgba(34,197,94,0.2)',  color: 'rgb(74,222,128)',  borderColor: 'rgba(34,197,94,0.4)' },
  reopened:     { backgroundColor: 'rgba(239,68,68,0.2)',  color: 'rgb(248,113,113)', borderColor: 'rgba(239,68,68,0.4)' },
};

// ─── inner component (reads searchParams) ────────────────────────────────────
function MyTicketsInner() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const initialStatus = (searchParams.get('status') ?? '') as TicketStatus | '';

  const [tickets,       setTickets]       = useState<Ticket[]>([]);
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // filters
  const [statusFilter,   setStatusFilter]   = useState<TicketStatus | ''>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [typeFilter,     setTypeFilter]     = useState<TicketType | ''>('');
  const [projectFilter,  setProjectFilter]  = useState<number | ''>('');
  const [searchQuery,    setSearchQuery]    = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // keep URL in sync with status tab so deep-links work
  const handleStatusChange = (s: TicketStatus | '') => {
    setStatusFilter(s);
    const params = new URLSearchParams(searchParams.toString());
    if (s) params.set('status', s); else params.delete('status');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [myTickets, allProjects] = await Promise.all([
          ticketsApi.getMyTickets(),
          projectsApi.getProjects(),
        ]);
        setTickets(myTickets);
        setProjects(allProjects);
      } catch {
        showToast('Failed to load your tickets', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── derived filtered list ──────────────────────────────────────────────────
  const displayed = tickets.filter((t) => {
    if (statusFilter   && t.status   !== statusFilter)   return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (typeFilter     && t.type     !== typeFilter)     return false;
    if (projectFilter  && t.project  !== projectFilter)  return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.ticket_id.toLowerCase().includes(q) &&
        !(t.description ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const stats = {
    total:      tickets.length,
    new:        tickets.filter(t => t.status === 'new').length,
    in_progress:tickets.filter(t => t.status === 'in_progress').length,
    qa:         tickets.filter(t => t.status === 'qa').length,
    closed:     tickets.filter(t => t.status === 'closed').length,
    reopened:   tickets.filter(t => t.status === 'reopened').length,
  };

  const clearFilters = () => {
    setSearchQuery('');
    handleStatusChange('');
    setPriorityFilter('');
    setTypeFilter('');
    setProjectFilter('');
  };

  const hasActiveFilters = !!(statusFilter || priorityFilter || typeFilter || projectFilter || searchQuery);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Breadcrumb + Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2 text-sm">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
          <span className="text-slate-600">/</span>
          <span className="text-white">My Tickets</span>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My Tickets</h1>
            <p className="text-slate-400 mt-1">All tickets assigned to you</p>
          </div>
          <Link
            href="/protected/dashboard/tickets/new"
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Ticket
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STATUS_TABS.map(({ value, label }) => {
          const count = value === '' ? stats.total
            : value === 'in_progress' ? stats.in_progress
            : stats[value as keyof typeof stats] ?? 0;
          const isActive = statusFilter === value;
          return (
            <button
              key={value}
              onClick={() => handleStatusChange(value)}
              className={`rounded-xl p-4 border text-left transition-all hover:scale-[1.02] ${
                isActive
                  ? 'ring-2 ring-offset-1 ring-offset-slate-900'
                  : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
              }`}
              style={isActive ? { ...TAB_ACTIVE_STYLES[value], border: `1px solid` } : {}}
            >
              <p className="text-xs text-slate-400 mb-1 capitalize">{label}</p>
              <p className={`text-2xl font-bold ${isActive ? '' : 'text-white'}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search + Filter Bar */}
      <div className="filter-bar mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] search-input flex items-center">
            <div className="pl-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by title, ID or description..."
              className="w-full bg-transparent border-0 pl-3 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-0 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="pr-3 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Priority */}
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

          {/* Type */}
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

          {/* Project */}
          <select
            className="input-field min-w-[140px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-slate-400 mb-3">
          Showing <span className="text-white font-medium">{displayed.length}</span> of{' '}
          <span className="text-white font-medium">{tickets.length}</span> ticket{tickets.length !== 1 ? 's' : ''}
          {hasActiveFilters ? ' (filtered)' : ''}
        </p>
      )}

      {/* Ticket Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400 mx-auto" />
            <p className="text-slate-400 mt-4 text-sm">Loading your tickets…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-14 h-14 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-slate-300 font-medium mb-1">No tickets found</p>
            <p className="text-slate-500 text-sm">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'You have no tickets assigned yet.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-medium">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {displayed.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/protected/dashboard/tickets/${ticket.id}`} className="block">
                        <p className="text-sm font-medium text-white group-hover:text-sky-400 transition-colors">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{ticket.ticket_id}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[ticket.status]}`}>
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
                      <span className="text-sm text-slate-300">{ticket.project_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {new Date(ticket.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
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

// ─── page export (wraps in Suspense for useSearchParams) ─────────────────────
export default function MyTicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" />
      </div>
    }>
      <MyTicketsInner />
    </Suspense>
  );
}
