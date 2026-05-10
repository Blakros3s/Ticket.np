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

export interface TicketActiveSession {
  active: boolean;
  work_log?: WorkLog;
  elapsed_seconds?: number;
  elapsed_formatted?: string;
  user_id?: number;
  user_name?: string;
  error?: string;
}

export const timelogsApi = {
  getTicketActiveSession: async (ticketId: number): Promise<TicketActiveSession> => {
    const response = await api.get<TicketActiveSession>(`/timelogs/worklogs/ticket_active_session/?ticket_id=${ticketId}`);
    return response.data;
  },
};
