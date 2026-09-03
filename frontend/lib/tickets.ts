import api from './api';
import { buildQueryString, normalizeListResponse, normalizePaginatedResponse, PaginatedResponse } from './http-utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

export const resolveMediaUrl = (url: string) => {
  if (!url) return '';

  let resolved = url;
  if (resolved.startsWith('http://backend:') || resolved.startsWith('http://backend/')) {
    resolved = resolved.replace(/^http:\/\/backend(?::\d+)?/, API_ORIGIN);
  }

  if (resolved.startsWith('http')) {
    return resolved;
  }

  const normalized = resolved.startsWith('/') ? resolved : `/${resolved}`;
  if (normalized.startsWith('/api/')) {
    return `${API_ORIGIN}${normalized}`;
  }
  if (normalized.startsWith('/media/')) {
    return `${API_ORIGIN}/api${normalized}`;
  }
  return `${API_ORIGIN}/api/media/${resolved.replace(/^\//, '')}`;
};

const toMediaFetchPath = (fileValue: string) => {
  if (!fileValue) return '';

  if (fileValue.startsWith('http')) {
    const parsed = new URL(resolveMediaUrl(fileValue));
    return `${parsed.pathname.replace(/^\/api/, '')}${parsed.search}`;
  }

  if (fileValue.startsWith('/api/')) {
    return `${fileValue.slice('/api'.length)}`;
  }
  if (fileValue.startsWith('/media/')) {
    return fileValue;
  }
  if (fileValue.startsWith('media/')) {
    return `/${fileValue}`;
  }
  return `/media/${fileValue.replace(/^\//, '')}`;
};

export const fetchMediaBlobUrl = async (fileValue: string): Promise<string> => {
  const path = toMediaFetchPath(fileValue);
  const response = await api.get(path, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
};

export const isImageMedia = (media: TicketMedia) => {
  if (media.file_type === 'image') return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(media.file_name);
};

export type TicketMediaKind = 'image' | 'pdf' | 'video' | 'file';

export const resolveMediaKind = (media: TicketMedia): TicketMediaKind => {
  if (isImageMedia(media)) return 'image';
  if (media.file_type === 'video') return 'video';
  if (media.file_name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
};

export type ConversationTimelineItem =
  | { kind: 'comment'; key: string; createdAt: number; comment: TicketComment }
  | { kind: 'attachment'; key: string; createdAt: number; media: TicketMedia };

export function buildConversationTimeline(
  ticket: Pick<Ticket, 'comments' | 'media_files'>,
): ConversationTimelineItem[] {
  const items: ConversationTimelineItem[] = [];

  for (const comment of ticket.comments ?? []) {
    items.push({
      kind: 'comment',
      key: `comment-${comment.id}`,
      createdAt: Date.parse(comment.created_at),
      comment,
    });
  }

  for (const media of ticket.media_files ?? []) {
    items.push({
      kind: 'attachment',
      key: `attachment-${media.id}`,
      createdAt: Date.parse(media.created_at),
      media,
    });
  }

  return items.sort((a, b) => a.createdAt - b.createdAt);
}

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
  content: string;
  media_files?: TicketMedia[];
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

export interface TicketGitHubLink {
  repo_owner: string;
  repo_name: string;
  issue_number: number;
  issue_url: string;
  sync_status: 'linked' | 'error' | 'disconnected';
  last_sync_error?: string;
  last_synced_at?: string | null;
  created_at?: string;
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
  created_by_id: number;
  created_at: string;
  updated_at: string;
  media_files?: TicketMedia[];
  comments?: TicketComment[];
  media_count?: number;
  comment_count?: number;
  in_progress_at: string | null;
  qa_at: string | null;
  closed_at: string | null;
  due_date: string | null;
  module: string | null;
  is_overdue?: boolean;
  github_link?: TicketGitHubLink | null;
}

export interface CreateTicketData {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  project: number;
  assignees?: number[];
  media_files?: File[];
  due_date?: string | null;
  module?: string | null;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  assignees?: number[];
  due_date?: string | null;
  module?: string | null;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  project?: number;
  assignee?: number;
  exclude_status?: string;
  ordering?: string;
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
      assignee: filters?.assignee,
      exclude_status: filters?.exclude_status,
      ordering: filters?.ordering,
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
      if (data.due_date) {
        formData.append('due_date', data.due_date);
      }
      if (data.module) {
        formData.append('module', data.module);
      }
      if (data.assignees && data.assignees.length > 0) {
        data.assignees.forEach((id) => {
          formData.append('assignees', String(id));
        });
      }
      data.media_files.forEach((file) => {
        formData.append('media_files', file);
      });
      
      const response = await api.post<Ticket>('/tickets/tickets/', formData);
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

  createGithubIssue: async (id: number): Promise<Ticket> => {
    const response = await api.post<Ticket>(`/tickets/tickets/${id}/create-github-issue/`);
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

  addComment: async (ticketId: number, content: string, files: File[] = []): Promise<TicketComment> => {
    if (files.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      files.forEach((file) => formData.append('files', file));
      const response = await api.post<TicketComment>(
        `/tickets/tickets/${ticketId}/comments/`,
        formData,
      );
      return response.data;
    }

    const response = await api.post<TicketComment>(`/tickets/tickets/${ticketId}/comments/`, { content });
    return response.data;
  },
};
