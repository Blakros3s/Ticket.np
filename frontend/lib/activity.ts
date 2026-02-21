import api from './api';

export interface ActivityLog {
  id: number;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'assignment_change' | 'comment' | 'work_log';
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  } | null;
  user_name: string;
  description: string;
  target_type: string | null;
  target_id: number | null;
  target_str: string | null;
  extra_data: Record<string, any>;
  created_at: string;
}

export const activityApi = {
  getActivityLogs: async (ticketId?: number, userId?: number, action?: string): Promise<ActivityLog[]> => {
    const params = new URLSearchParams();
    if (ticketId) params.append('ticket_id', ticketId.toString());
    if (userId) params.append('user_id', userId.toString());
    if (action) params.append('action', action);
    
    const queryString = params.toString();
    const url = `/activity/${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<ActivityLog[]>(url);
    return response.data;
  },

  getActivityByTicket: async (ticketId: number): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>(`/activity/by_ticket/?ticket_id=${ticketId}`);
    return response.data;
  },

  getRecentActivity: async (limit: number = 10): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>(`/activity/recent/?limit=${limit}`);
    return response.data;
  },
};
