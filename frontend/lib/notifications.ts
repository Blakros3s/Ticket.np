import api from './api';

export interface Notification {
  id: number;
  message: string;
  ticket_id: number | null;
  ticket_title: string;
  project_id: number | null;
  project_name: string;
  created_at: string;
  read: boolean;
}

export const notificationsApi = {
  getNotifications: async (): Promise<Notification[]> => {
    const response = await api.get<Notification[] | { results: Notification[] }>('/notifications/');
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'results' in data) return data.results;
    return [];
  },

  markRead: async (id: number): Promise<Notification> => {
    const response = await api.post<Notification>(`/notifications/${id}/mark_read/`);
    return response.data;
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/mark_all_read/');
  },
};
