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
  getActivityByTicket: async (ticketId: number): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>(`/activity/by_ticket/?ticket_id=${ticketId}`);
    return response.data;
  },
};
