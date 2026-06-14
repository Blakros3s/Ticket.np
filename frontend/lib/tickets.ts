import api from './api';
import { buildQueryString, normalizeListResponse, normalizePaginatedResponse, PaginatedResponse } from './http-utils';

export type TicketType = 'bug' | 'task' | 'feature';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'new' | 'in_progress' | 'qa' | 'closed' | 'reopened';

export interface TicketMedia {
  id: number;
  file: string;
  file_name: string;
  file_type: 'image' | 'video' | 'document' | 'other';
  file_size: number;
  uploaded_by: number;
  uploaded_by_username: string;
  created_at: string;
}

export interface TicketComment {
  id: number;
  author: number;
  user_name: string;
  user_username: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TicketAssignee {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

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
  assignees: number[];
  assignees_list: TicketAssignee[];
  created_by: string;
  created_at: string;
  updated_at: string;
  media_files: TicketMedia[];
  comments: TicketComment[];
  in_progress_at: string | null;
  qa_at: string | null;
  closed_at: string | null;
}

export interface CreateTicketData {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  project: number;
  assignees?: number[];
  media_files?: File[];
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignees?: number[];
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  project?: number;
  search?: string;
  page?: number;
}

export const ticketsApi = {
  getTickets: async (filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> => {
    const queryString = buildQueryString({
      status: filters?.status,
      priority: filters?.priority,
      type: filters?.type,
      project: filters?.project,
      search: filters?.search,
      page: filters?.page,
    });
    const response = await api.get<any>(`/tickets/tickets/${queryString}`);
    return normalizePaginatedResponse<Ticket>(response.data);
  },

  getTicketStats: async (filters?: TicketFilters): Promise<Record<string, number>> => {
    const response = await api.get<Record<string, number>>('/tickets/tickets/stats/', {
      params: {
        priority: filters?.priority,
        type: filters?.type,
        project: filters?.project,
        search: filters?.search,
      },
    });
    return response.data;
  },

  getTicket: async (id: number): Promise<Ticket> => {
    const response = await api.get<Ticket>(`/tickets/tickets/${id}/`);
    return response.data;
  },

  createTicket: async (data: CreateTicketData): Promise<Ticket> => {
    if (data.media_files && data.media_files.length > 0) {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('type', data.type);
      formData.append('priority', data.priority);
      formData.append('project', data.project.toString());
      if (data.assignees && data.assignees.length > 0) {
        data.assignees.forEach(id => formData.append('assignees', id.toString()));
      }
      data.media_files.forEach((file) => {
        formData.append('media_files', file);
      });
      
      const response = await api.post<Ticket>('/tickets/tickets/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    }
    
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
    return normalizeListResponse(response.data);
  },

  getTicketsByProject: async (projectId: number): Promise<Ticket[]> => {
    const response = await api.get<Ticket[] | { results: Ticket[] }>(`/tickets/tickets/by_project/?project_id=${projectId}`);
    return normalizeListResponse(response.data);
  },

  selfAssign: async (id: number): Promise<Ticket> => {
    const response = await api.post<Ticket>(`/tickets/tickets/${id}/self_assign/`);
    return response.data;
  },

  assignTicket: async (id: number, userId: number): Promise<Ticket> => {
    const response = await api.post<Ticket>(`/tickets/tickets/${id}/assign_ticket/`, { user_id: userId });
    return response.data;
  },

  unassignTicket: async (id: number, userId?: number): Promise<Ticket> => {
    const response = await api.post<Ticket>(`/tickets/tickets/${id}/unassign/`, userId != null ? { user_id: userId } : {});
    return response.data;
  },

  uploadMedia: async (ticketId: number, file: File): Promise<TicketMedia> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<TicketMedia>(
      `/tickets/tickets/${ticketId}/media/`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteMedia: async (ticketId: number, mediaId: number): Promise<void> => {
    await api.delete(`/tickets/tickets/${ticketId}/media/${mediaId}/`);
  },

  getComments: async (ticketId: number): Promise<TicketComment[]> => {
    const response = await api.get<TicketComment[]>(`/tickets/tickets/${ticketId}/comments/`);
    return response.data;
  },

  addComment: async (ticketId: number, content: string): Promise<TicketComment> => {
    const response = await api.post<TicketComment>(`/tickets/tickets/${ticketId}/comments/`, { content });
    return response.data;
  },
};
