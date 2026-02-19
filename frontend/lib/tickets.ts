import api from './api';

export type TicketType = 'bug' | 'task' | 'feature';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'new' | 'in_progress' | 'qa' | 'closed' | 'reopened';

export interface Ticket {
  id: number;
  ticket_id: string;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  project: number;
  project_name: string;
  assignee: number | null;
  assignee_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketData {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  project: number;
  assignee?: number | null;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignee?: number | null;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  project?: number;
  search?: string;
}

export const ticketsApi = {
  getTickets: async (filters?: TicketFilters): Promise<Ticket[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.project) params.append('project', filters.project.toString());
    if (filters?.search) params.append('search', filters.search);
    
    const queryString = params.toString();
    const url = `/tickets/tickets/${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<Ticket[] | { results: Ticket[] }>(url);
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  getTicket: async (id: number): Promise<Ticket> => {
    const response = await api.get<Ticket>(`/tickets/tickets/${id}/`);
    return response.data;
  },

  createTicket: async (data: CreateTicketData): Promise<Ticket> => {
    const response = await api.post<Ticket>('/tickets/tickets/', data);
    return response.data;
  },

  updateTicket: async (id: number, data: UpdateTicketData): Promise<Ticket> => {
    const response = await api.patch<Ticket>(`/tickets/tickets/${id}/`, data);
    return response.data;
  },

  deleteTicket: async (id: number): Promise<void> => {
    await api.delete(`/tickets/tickets/${id}/`);
  },

  updateStatus: async (id: number, status: TicketStatus): Promise<Ticket> => {
    const response = await api.patch<Ticket>(`/tickets/tickets/${id}/update_status/`, { status });
    return response.data;
  },

  getMyTickets: async (): Promise<Ticket[]> => {
    const response = await api.get<Ticket[] | { results: Ticket[] }>('/tickets/tickets/my_tickets/');
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  getTicketsByProject: async (projectId: number): Promise<Ticket[]> => {
    const response = await api.get<Ticket[] | { results: Ticket[] }>(`/tickets/tickets/by_project/?project_id=${projectId}`);
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  selfAssign: async (id: number): Promise<Ticket> => {
    const response = await api.post<Ticket>(`/tickets/tickets/${id}/self_assign/`);
    return response.data;
  },
};
