import api from './api';

export interface Comment {
  id: number;
  ticket: number;
  author: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentData {
  ticket: number;
  content: string;
}

export const commentsApi = {
  getComments: async (ticketId?: number): Promise<Comment[]> => {
    const params = new URLSearchParams();
    if (ticketId) params.append('ticket_id', ticketId.toString());
    
    const queryString = params.toString();
    const url = `/comments/${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<Comment[]>(url);
    return response.data;
  },

  getCommentsByTicket: async (ticketId: number): Promise<Comment[]> => {
    const response = await api.get<Comment[]>(`/comments/by_ticket/?ticket_id=${ticketId}`);
    return response.data;
  },

  createComment: async (data: CreateCommentData): Promise<Comment> => {
    const response = await api.post<Comment>('/comments/', data);
    return response.data;
  },

  updateComment: async (id: number, content: string): Promise<Comment> => {
    const response = await api.patch<Comment>(`/comments/${id}/`, { content });
    return response.data;
  },

  deleteComment: async (id: number): Promise<void> => {
    await api.delete(`/comments/${id}/`);
  },
};
