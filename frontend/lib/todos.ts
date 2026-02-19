import api from './api';

export interface TodoItem {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  priority_display: string;
  priority_color: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  status_display: string;
  due_date?: string;
  due_time?: string;
  is_completed: boolean;
  completed_at?: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoItemInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  is_completed?: boolean;
}

export interface TodoPriority {
  value: string;
  label: string;
  color: string;
}

export interface TodoStatus {
  value: string;
  label: string;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_rate: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
}

export const todosApi = {
  // Get all todos for current user
  getTodos: async (filters?: { priority?: string; status?: string; is_completed?: boolean }): Promise<TodoItem[]> => {
    const response = await api.get('/todos/todos/', { params: filters });
    return response.data.results;
  },

  // Get single todo
  getTodo: async (id: number): Promise<TodoItem> => {
    const response = await api.get(`/todos/todos/${id}/`);
    return response.data;
  },

  // Create todo
  createTodo: async (data: TodoItemInput): Promise<TodoItem> => {
    const response = await api.post('/todos/todos/', data);
    return response.data;
  },

  // Update todo
  updateTodo: async (id: number, data: Partial<TodoItemInput>): Promise<TodoItem> => {
    const response = await api.patch(`/todos/todos/${id}/`, data);
    return response.data;
  },

  // Delete todo
  deleteTodo: async (id: number): Promise<void> => {
    await api.delete(`/todos/todos/${id}/`);
  },

  // Complete todo
  completeTodo: async (id: number): Promise<TodoItem> => {
    const response = await api.post(`/todos/todos/${id}/complete/`);
    return response.data;
  },

  // Reopen todo
  reopenTodo: async (id: number): Promise<TodoItem> => {
    const response = await api.post(`/todos/todos/${id}/reopen/`);
    return response.data;
  },

  // Bulk complete todos
  bulkComplete: async (ids: number[]): Promise<{ updated: number }> => {
    const response = await api.post('/todos/todos/bulk_complete/', { ids });
    return response.data;
  },

  // Bulk delete todos
  bulkDelete: async (ids: number[]): Promise<{ deleted: number }> => {
    const response = await api.post('/todos/todos/bulk_delete/', { ids });
    return response.data;
  },

  // Get todo statistics
  getStats: async (): Promise<TodoStats> => {
    const response = await api.get('/todos/todos/stats/');
    return response.data;
  },

  // Get priority choices
  getPriorities: async (): Promise<TodoPriority[]> => {
    const response = await api.get('/todos/todos/priorities/');
    return response.data;
  },

  // Get status choices
  getStatuses: async (): Promise<TodoStatus[]> => {
    const response = await api.get('/todos/todos/statuses/');
    return response.data;
  },
};
