'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { todosApi, TodoItem, TodoItemInput, TodoPriority, TodoStatus, TodoStats } from '@/lib/todos';
import { ConfirmDialog } from '@/components/confirm-dialog';

type ViewFilter = '' | 'pending' | 'in_progress' | 'completed';

function formatDueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusBadgeClass(status: TodoItem['status']): string {
  switch (status) {
    case 'completed':
      return 'todo-status-badge badge-success';
    case 'in_progress':
      return 'todo-status-badge badge-accent';
    case 'cancelled':
      return 'todo-status-badge badge-neutral';
    default:
      return 'todo-status-badge badge-warning';
  }
}

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [priorities, setPriorities] = useState<TodoPriority[]>([]);
  const [statuses, setStatuses] = useState<TodoStatus[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [viewFilter, setViewFilter] = useState<ViewFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null);
  const [todoToDelete, setTodoToDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<TodoItemInput>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    due_date: '',
  });

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchTodos();
    fetchPriorities();
    fetchStatuses();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const filters: { status?: string; priority?: string } = {};
      if (filter.status) filters.status = filter.status;
      if (filter.priority) filters.priority = filter.priority;

      const data = await todosApi.getTodos(filters);
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
      showToastMessage('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPriorities = async () => {
    try {
      const data = await todosApi.getPriorities();
      setPriorities(data);
    } catch (error) {
      console.error('Error fetching priorities:', error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const data = await todosApi.getStatuses();
      setStatuses(data);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await todosApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const displayedTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return todos.filter((todo) => {
      if (viewFilter && todo.status !== viewFilter) return false;
      if (!query) return true;
      return (
        todo.title.toLowerCase().includes(query) ||
        (todo.description || '').toLowerCase().includes(query)
      );
    });
  }, [todos, searchQuery, viewFilter]);

  const openAddModal = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending',
      due_date: '',
    });
    setIsEditing(false);
    setSelectedTodo(null);
    setIsModalOpen(true);
  };

  const openEditModal = (todo: TodoItem) => {
    setSelectedTodo(todo);
    setFormData({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      status: todo.status,
      due_date: todo.due_date || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTodo(null);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const buildPayload = (): Partial<TodoItemInput> => {
    const payload: Partial<TodoItemInput> = {
      title: formData.title.trim(),
      description: formData.description?.trim() || '',
      priority: formData.priority,
      status: formData.status,
    };

    if (formData.due_date) {
      payload.due_date = formData.due_date;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (isEditing && selectedTodo) {
        await todosApi.updateTodo(selectedTodo.id, payload);
        showToastMessage('Task updated', 'success');
      } else {
        await todosApi.createTodo(payload as TodoItemInput);
        showToastMessage('Task created', 'success');
      }

      closeModal();
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error saving todo:', error);
      showToastMessage('Failed to save task', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const promptDelete = (id: number) => {
    setTodoToDelete(id);
    setDeleteTarget('single');
  };

  const promptBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget('bulk');
  };

  const confirmDelete = async () => {
    if (deleteTarget === 'single' && todoToDelete !== null) {
      try {
        await todosApi.deleteTodo(todoToDelete);
        showToastMessage('Task deleted', 'success');
        fetchTodos();
        fetchStats();
      } catch (error) {
        console.error('Error deleting todo:', error);
        showToastMessage('Failed to delete task', 'error');
      }
    } else if (deleteTarget === 'bulk') {
      try {
        await todosApi.bulkDelete(selectedIds);
        showToastMessage(`${selectedIds.length} tasks deleted`, 'success');
        setSelectedIds([]);
        fetchTodos();
        fetchStats();
      } catch (error) {
        console.error('Error bulk deleting:', error);
        showToastMessage('Failed to delete tasks', 'error');
      }
    }
    setDeleteTarget(null);
    setTodoToDelete(null);
  };

  const handleComplete = async (id: number) => {
    try {
      await todosApi.completeTodo(id);
      showToastMessage('Task completed', 'success');
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error completing todo:', error);
      showToastMessage('Failed to complete task', 'error');
    }
  };

  const handleReopen = async (id: number) => {
    try {
      await todosApi.reopenTodo(id);
      showToastMessage('Task reopened', 'success');
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error reopening todo:', error);
      showToastMessage('Failed to reopen task', 'error');
    }
  };

  const handleBulkComplete = async () => {
    if (selectedIds.length === 0) return;

    try {
      await todosApi.bulkComplete(selectedIds);
      showToastMessage(`${selectedIds.length} tasks completed`, 'success');
      setSelectedIds([]);
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error bulk completing:', error);
      showToastMessage('Failed to complete tasks', 'error');
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === displayedTodos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedTodos.map((t) => t.id));
    }
  };

  const handleViewFilter = (value: ViewFilter) => {
    setViewFilter(value);
    setFilter((prev) => ({ ...prev, status: value }));
  };

  const viewTabs: { id: ViewFilter; label: string }[] = [
    { id: '', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="page-container">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.message}
        </div>
      )}

      <header className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <nav className="breadcrumb">
              <Link href="/protected/dashboard">Dashboard</Link>
              <span className="breadcrumb-sep">/</span>
              <span>Todos</span>
            </nav>
            <h1 className="page-title">Todos</h1>
            <p className="page-subtitle">Personal tasks and reminders</p>
          </div>
          <button type="button" onClick={openAddModal} className="btn-primary px-4 py-2.5 shrink-0 self-start sm:self-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New task
          </button>
        </div>
      </header>

      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-card-label">Total</p>
              <p className="stat-card-value">{stats.total}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Pending</p>
              <p className="stat-card-value dashboard-stat-accent-amber">{stats.pending}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Completed</p>
              <p className="stat-card-value dashboard-stat-accent-green">{stats.completed}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Overdue</p>
              <p className="stat-card-value dashboard-stat-accent-red">{stats.overdue}</p>
            </div>
          </div>

          <div className="todo-progress-panel">
            <span className="meta-text text-xs whitespace-nowrap">Completion</span>
            <div className="todo-progress-track">
              <div
                className="todo-progress-fill"
                style={{ width: `${Math.min(100, stats.completion_rate)}%` }}
              />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {Math.round(stats.completion_rate)}%
            </span>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <nav className="ticket-view-nav" aria-label="Task views">
          {viewTabs.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              onClick={() => handleViewFilter(tab.id)}
              className={`ticket-view-nav__link${viewFilter === tab.id ? ' ticket-view-nav__link--active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="surface-panel overflow-hidden p-0">
        <div className="todo-toolbar">
          <div className="relative flex-1 min-w-[12rem] max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search tasks..."
              className="input-field pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            value={filter.priority}
            onChange={(e) => setFilter((prev) => ({ ...prev, priority: e.target.value }))}
            className="input-field ticket-filter-select w-auto min-w-[8rem]"
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            {priorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {selectedIds.length > 0 && (
            <div className="todo-bulk-actions">
              <span className="meta-text text-xs">{selectedIds.length} selected</span>
              <button type="button" onClick={handleBulkComplete} className="btn-secondary px-2.5 py-1 text-xs">
                Complete
              </button>
              <button
                type="button"
                onClick={promptBulkDelete}
                className="btn-secondary px-2.5 py-1 text-xs"
                style={{ color: 'var(--danger)' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="empty-state py-16">
            <div
              className="animate-spin rounded-full h-8 w-8 border-2 mx-auto mb-4"
              style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--accent)' }}
            />
            <p>Loading tasks...</p>
          </div>
        ) : displayedTodos.length === 0 ? (
          <div className="empty-state py-16">
            <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No tasks found</p>
            <p className="meta-text text-sm mb-4">Create a task to get started</p>
            <button type="button" onClick={openAddModal} className="btn-primary px-4 py-2">
              New task
            </button>
          </div>
        ) : (
          <>
            <div className="todo-list-header">
              <span>
                <input
                  type="checkbox"
                  checked={selectedIds.length === displayedTodos.length && displayedTodos.length > 0}
                  onChange={selectAll}
                  aria-label="Select all tasks"
                />
              </span>
              <span />
              <span>Task</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Due</span>
              <span className="text-right">Actions</span>
            </div>

            {displayedTodos.map((todo) => (
              <div
                key={todo.id}
                className={`todo-row${todo.is_completed ? ' todo-row--completed' : ''}${todo.is_overdue && !todo.is_completed ? ' todo-row--overdue' : ''}`}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(todo.id)}
                    onChange={() => toggleSelection(todo.id)}
                    aria-label={`Select ${todo.title}`}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => (todo.is_completed ? handleReopen(todo.id) : handleComplete(todo.id))}
                    className={`todo-complete-btn${todo.is_completed ? ' todo-complete-btn--done' : ''}`}
                    aria-label={todo.is_completed ? 'Reopen task' : 'Complete task'}
                  >
                    {todo.is_completed && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="todo-row-title">{todo.title}</p>
                  {todo.description && <p className="todo-row-desc">{todo.description}</p>}
                  <div className="todo-row-meta">
                    <span
                      className="todo-priority-badge"
                      style={{
                        backgroundColor: `${todo.priority_color}18`,
                        color: todo.priority_color,
                      }}
                    >
                      {todo.priority_display}
                    </span>
                    <span className={statusBadgeClass(todo.status)}>{todo.status_display}</span>
                    {todo.due_date && (
                      <span className={`todo-due${todo.is_overdue && !todo.is_completed ? ' todo-due--overdue' : ''}`}>
                        {formatDueDate(todo.due_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="todo-row-col">
                  <span
                    className="todo-priority-badge"
                    style={{
                      backgroundColor: `${todo.priority_color}18`,
                      color: todo.priority_color,
                    }}
                  >
                    {todo.priority_display}
                  </span>
                </div>

                <div className="todo-row-col">
                  <span className={statusBadgeClass(todo.status)}>{todo.status_display}</span>
                </div>

                <div className="todo-row-col">
                  {todo.due_date ? (
                    <span className={`todo-due${todo.is_overdue && !todo.is_completed ? ' todo-due--overdue' : ''}`}>
                      {formatDueDate(todo.due_date)}
                    </span>
                  ) : (
                    <span className="meta-text">—</span>
                  )}
                </div>

                <div className="todo-row-actions">
                  <button type="button" onClick={() => openEditModal(todo)} className="icon-btn" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => promptDelete(todo.id)} className="icon-btn icon-btn-danger" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-panel todo-form-modal max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{isEditing ? 'Edit task' : 'New task'}</h2>
                <p className="todo-form-subtitle">
                  {isEditing ? 'Update details, priority, or status.' : 'Add a task to your personal list.'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="icon-btn" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-5">
                <div className="todo-form-field">
                  <label htmlFor="todo-title" className="todo-form-label">
                    Title *
                  </label>
                  <input
                    id="todo-title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="input-field todo-form-input-lg"
                    placeholder="What needs to be done?"
                    autoFocus
                  />
                </div>

                <div className="todo-form-field">
                  <label htmlFor="todo-description" className="todo-form-label">
                    Description
                  </label>
                  <textarea
                    id="todo-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="input-field resize-none"
                    placeholder="Optional notes or context..."
                  />
                </div>

                <div className="todo-form-field">
                  <span className="todo-form-label">Priority</span>
                  <div className="todo-choice-row">
                    {priorities.map((p) => {
                      const isActive = formData.priority === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          className={`todo-choice-btn${isActive ? ' todo-choice-btn--active' : ''}`}
                          style={
                            isActive
                              ? {
                                  borderColor: p.color,
                                  backgroundColor: `${p.color}18`,
                                  color: p.color,
                                  boxShadow: `0 0 0 1px ${p.color}40`,
                                }
                              : undefined
                          }
                          onClick={() => setFormData((prev) => ({ ...prev, priority: p.value as TodoItemInput['priority'] }))}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="todo-form-field">
                  <span className="todo-form-label">Status</span>
                  <div className="todo-choice-row">
                    {statuses.map((s) => {
                      const isActive = formData.status === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          className={`todo-choice-btn todo-choice-btn--status todo-choice-btn--${s.value}${isActive ? ' todo-choice-btn--active' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, status: s.value as TodoItemInput['status'] }))}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="todo-form-field">
                  <label htmlFor="todo-due-date" className="todo-form-label">
                    Due date
                  </label>
                  <div className="todo-date-row">
                    <input
                      id="todo-due-date"
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                      className="input-field"
                    />
                    {formData.due_date && (
                      <button
                        type="button"
                        className="todo-date-clear"
                        onClick={() => setFormData((prev) => ({ ...prev, due_date: '' }))}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete task"
        message={
          deleteTarget === 'bulk'
            ? `Delete ${selectedIds.length} selected task${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`
            : 'Delete this task? This cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setTodoToDelete(null);
        }}
      />
    </div>
  );
}
