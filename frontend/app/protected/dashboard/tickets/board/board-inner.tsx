'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useProjects } from '@/lib/data-hooks';
import { Ticket, TicketStatus, ticketsApi } from '@/lib/tickets';

const BOARD_COLUMNS: { key: TicketStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'qa', label: 'QA' },
  { key: 'reopened', label: 'Reopened' },
];

const priorityColors: Record<string, string> = {
  low: 'border-slate-500',
  medium: 'border-blue-500',
  high: 'border-orange-500',
  critical: 'border-red-500',
};

export default function TicketBoardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialProject = searchParams.get('project') ? Number(searchParams.get('project')) : '';

  const { data: projects = [] } = useProjects();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<number | ''>(initialProject);
  const [showClosed, setShowClosed] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBoard = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const ticketResponse = await ticketsApi.getTickets({
          project: projectFilter || undefined,
          assignee: user.id,
          exclude_status: showClosed ? undefined : 'closed',
          ordering: 'due_date',
          page: 1,
        });
      setTickets(ticketResponse.results);
    } catch {
      showToast('Failed to load board', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, showClosed, user]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<string, Ticket[]> = {
      new: [],
      in_progress: [],
      qa: [],
      reopened: [],
    };
    if (showClosed) grouped.closed = [];

    for (const ticket of tickets) {
      if (grouped[ticket.status]) {
        grouped[ticket.status].push(ticket);
      }
    }
    return grouped;
  }, [tickets, showClosed]);

  const columns = showClosed
    ? [...BOARD_COLUMNS, { key: 'closed' as TicketStatus, label: 'Closed' }]
    : BOARD_COLUMNS;

  const handleDrop = async (ticketId: number, newStatus: TicketStatus) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    try {
      const updated = await ticketsApi.updateStatus(ticketId, newStatus);
      setTickets((prev) => prev.map((item) => (item.id === ticketId ? updated : item)));
      showToast(`Moved to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Status change failed';
      showToast(message, 'error');
    }
  };

  return (
    <div className="page-container">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="breadcrumb">Dashboard</Link>
          <span className="text-slate-500">/</span>
          <Link href="/protected/dashboard/tickets" className="breadcrumb">Tickets</Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Board</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold">Ticket Board</h1>
            <p className="page-subtitle mt-1">Your assigned tickets — drag to update status</p>
          </div>
          <nav className="ticket-view-nav" aria-label="Ticket views">
            <Link href="/protected/dashboard/tickets" className="ticket-view-nav__link">List</Link>
            <Link href="/protected/dashboard/tickets/board" className="ticket-view-nav__link ticket-view-nav__link--active">Board</Link>
            <Link href="/protected/dashboard/my-tickets" className="ticket-view-nav__link">My Tickets</Link>
          </nav>
        </div>
      </div>

      <div className="filter-bar ticket-toolbar mb-6">
        <select
          className="input-field ticket-filter-select"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')}
          aria-label="Filter by project"
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Show closed
        </label>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto" />
        </div>
      ) : (
        <div className="kanban-board">
          {columns.map((column) => (
            <section
              key={column.key}
              className="kanban-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const ticketId = Number(e.dataTransfer.getData('text/ticket-id'));
                if (ticketId) void handleDrop(ticketId, column.key);
                setDraggingId(null);
              }}
            >
              <header className="kanban-column__header">
                <h2>{column.label}</h2>
                <span>{ticketsByStatus[column.key]?.length || 0}</span>
              </header>
              <div className="kanban-column__body">
                {(ticketsByStatus[column.key] || []).map((ticket) => (
                  <article
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/ticket-id', String(ticket.id));
                      setDraggingId(ticket.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`kanban-card border-l-4 ${priorityColors[ticket.priority]} ${draggingId === ticket.id ? 'kanban-card--dragging' : ''}`}
                  >
                    <Link href={`/protected/dashboard/tickets/${ticket.id}`} className="kanban-card__title">
                      {ticket.title}
                    </Link>
                    <p className="kanban-card__meta">{ticket.ticket_id} · {ticket.project_name}</p>
                    {ticket.due_date && (
                      <p className={`kanban-card__due ${ticket.is_overdue ? 'kanban-card__due--overdue' : ''}`}>
                        Due {ticket.due_date}
                      </p>
                    )}
                    <p className="kanban-card__assignees">
                      {ticket.assignees_list?.map((a) => a.display_name).join(', ') || 'Unassigned'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
