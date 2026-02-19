'use client';

import React, { useState, useEffect } from 'react';
import { todosApi, TodoItem, TodoItemInput, TodoPriority, TodoStatus, TodoStats } from '@/lib/todos';

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [priorities, setPriorities] = useState<TodoPriority[]>([]);
  const [statuses, setStatuses] = useState<TodoStatus[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Form state
  const [formData, setFormData] = useState<TodoItemInput>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    due_date: '',
  });

  useEffect(() => {
    fetchTodos();
    fetchPriorities();
    fetchStatuses();
    fetchStats();
  }, [filter]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filter.status) filters.status = filter.status;
      if (filter.priority) filters.priority = filter.priority;
      
      const data = await todosApi.getTodos(filters);
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
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

  // Modal handlers
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

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isEditing && selectedTodo) {
        await todosApi.updateTodo(selectedTodo.id, formData);
      } else {
        await todosApi.createTodo(formData);
      }
      
      closeModal();
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error saving todo:', error);
      alert('Error saving todo. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this todo?')) {
      try {
        await todosApi.deleteTodo(id);
        fetchTodos();
        fetchStats();
      } catch (error) {
        console.error('Error deleting todo:', error);
        alert('Error deleting todo. Please try again.');
      }
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await todosApi.completeTodo(id);
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error completing todo:', error);
    }
  };

  const handleReopen = async (id: number) => {
    try {
      await todosApi.reopenTodo(id);
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error reopening todo:', error);
    }
  };

  const handleBulkComplete = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      await todosApi.bulkComplete(selectedIds);
      setSelectedIds([]);
      fetchTodos();
      fetchStats();
    } catch (error) {
      console.error('Error bulk completing:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedIds.length} todos?`)) {
      try {
        await todosApi.bulkDelete(selectedIds);
        setSelectedIds([]);
        fetchTodos();
        fetchStats();
      } catch (error) {
        console.error('Error bulk deleting:', error);
      }
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === todos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(todos.map(t => t.id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Todo Task</h1>
            <p className="text-slate-400">Manage your personal tasks and reminders</p>
          </div>
          
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-sky-400 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-slate-400">Total Tasks</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-400">{stats.pending}</div>
              <div className="text-sm text-slate-400">Pending</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-sky-400">{stats.completed}</div>
              <div className="text-sm text-slate-400">Completed</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
              <div className="text-sm text-slate-400">Overdue</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Status:</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">All</option>
                {statuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Priority:</label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">All</option>
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-slate-400">{selectedIds.length} selected</span>
                <button
                  onClick={handleBulkComplete}
                  className="px-3 py-1.5 text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Complete
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Todos List */}
        <div className="glass-card rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading tasks...</div>
          ) : todos.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">No tasks yet</h3>
              <p className="text-slate-400 mb-4">Get started by creating your first task</p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-gradient-to-r from-sky-400 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Create Task
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {/* Header */}
              <div className="px-6 py-3 bg-slate-800/50 flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedIds.length === todos.length && todos.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                />
                <div className="flex-1 text-sm font-medium text-slate-400">Task</div>
                <div className="w-24 text-sm font-medium text-slate-400">Priority</div>
                <div className="w-24 text-sm font-medium text-slate-400">Status</div>
                <div className="w-32 text-sm font-medium text-slate-400">Due Date</div>
                <div className="w-32 text-right text-sm font-medium text-slate-400">Actions</div>
              </div>

              {/* Todos */}
              {todos.map(todo => (
                <div
                  key={todo.id}
                  className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors ${
                    todo.is_completed ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(todo.id)}
                    onChange={() => toggleSelection(todo.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                  />
                  
                  <div className="flex-1">
                    <div className={`font-medium ${todo.is_completed ? 'line-through text-slate-500' : 'text-white'}`}>
                      {todo.title}
                    </div>
                    {todo.description && (
                      <div className="text-sm text-slate-400 mt-1 line-clamp-1">{todo.description}</div>
                    )}
                    {todo.is_overdue && !todo.is_completed && (
                      <div className="text-xs text-red-400 mt-1">Overdue</div>
                    )}
                  </div>

                  <div className="w-24">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${todo.priority_color}20`,
                        color: todo.priority_color,
                      }}
                    >
                      {todo.priority_display}
                    </span>
                  </div>

                  <div className="w-24">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      todo.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      todo.status === 'in_progress' ? 'bg-sky-500/20 text-sky-400' :
                      todo.status === 'cancelled' ? 'bg-slate-500/20 text-slate-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {todo.status_display}
                    </span>
                  </div>

                  <div className="w-32 text-sm text-slate-400">
                    {todo.due_date ? (
                      new Date(todo.due_date).toLocaleDateString()
                    ) : (
                      '-'
                    )}
                  </div>

                  <div className="w-32 flex items-center justify-end gap-2">
                    {todo.is_completed ? (
                      <button
                        onClick={() => handleReopen(todo.id)}
                        className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                        title="Reopen"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleComplete(todo.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Complete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    
                    <button
                      onClick={() => openEditModal(todo)}
                      className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {isEditing ? 'Edit Task' : 'Add Task'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    placeholder="e.g., Review project proposal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    placeholder="Add details about this task..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Priority *
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    >
                      {priorities.map(p => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Status *
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    >
                      {statuses.map(s => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-400 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {isEditing ? 'Update Task' : 'Add Task'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
