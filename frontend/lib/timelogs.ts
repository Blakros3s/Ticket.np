import api from './api';

export interface WorkLog {
  id: number;
  ticket: number;
  ticket_id_display: string;
  user: number;
  user_name: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  notes: string;
  created_at: string;
}

export interface ActiveSession {
  active: boolean;
  work_log?: WorkLog;
  elapsed_minutes?: number;
}

export interface TotalTime {
  ticket_id: string;
  total_minutes: number;
  total_hours: number;
  work_log_count: number;
}

export const timelogsApi = {
  getWorkLogs: async (ticketId?: number, userId?: number): Promise<WorkLog[]> => {
    const params = new URLSearchParams();
    if (ticketId) params.append('ticket_id', ticketId.toString());
    if (userId) params.append('user_id', userId.toString());
    
    const queryString = params.toString();
    const url = `/timelogs/worklogs/${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<WorkLog[] | { results: WorkLog[] }>(url);
    const data = response.data;
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'results' in data) {
      return data.results;
    }
    return [];
  },

  startWork: async (ticketId: number, notes?: string): Promise<WorkLog> => {
    const response = await api.post<WorkLog>('/timelogs/worklogs/start_work/', {
      ticket_id: ticketId,
      notes: notes || '',
    });
    return response.data;
  },

  stopWork: async (workLogId: number): Promise<WorkLog> => {
    const response = await api.post<WorkLog>(`/timelogs/worklogs/${workLogId}/stop_work/`);
    return response.data;
  },

  getActiveSession: async (): Promise<ActiveSession> => {
    const response = await api.get<ActiveSession>('/timelogs/worklogs/active_session/');
    return response.data;
  },

  getTotalTime: async (ticketId: number): Promise<TotalTime> => {
    const response = await api.get<TotalTime>(`/timelogs/worklogs/total_time/?ticket_id=${ticketId}`);
    return response.data;
  },

  getMyLogs: async (): Promise<WorkLog[]> => {
    const response = await api.get<WorkLog[]>('/timelogs/worklogs/my_logs/');
    return response.data;
  },

  updateWorkLog: async (id: number, notes: string): Promise<WorkLog> => {
    const response = await api.patch<WorkLog>(`/timelogs/worklogs/${id}/`, { notes });
    return response.data;
  },
};
