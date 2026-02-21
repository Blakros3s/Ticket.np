import api from './api';

export interface EmployeeDashboard {
  assigned_tickets_count: number;
  in_progress_count: number;
  completed_tickets_count: number;
  tickets_by_status: Record<string, number>;
  in_progress_tickets: Array<{
    id: number;
    ticket_id: string;
    title: string;
    project_name: string | null;
    priority: string;
    created_at: string;
  }>;
  recent_activity: Array<{
    id: number;
    action: string;
    description: string;
    created_at: string;
  }>;
  total_time_logged_hours: number;
  active_session: {
    id: number;
    ticket_id: string;
    ticket_title: string;
    start_time: string;
  } | null;
  tickets_due_soon: number;
}

export interface ManagerDashboard {
  total_projects: number;
  active_projects: number;
  archived_projects: number;
  total_tickets: number;
  tickets_by_status: Record<string, number>;
  tickets_by_priority: Record<string, number>;
  project_time_data: Array<{
    project_id: number;
    project_name: string;
    total_hours: number;
    ticket_count: number;
  }>;
  team_workload: Array<{
    user_id: number;
    user_name: string;
    project_id: number;
    project_name: string;
    assigned_tickets: number;
    in_progress: number;
  }>;
  recent_tickets: Array<{
    id: number;
    ticket_id: string;
    title: string;
    project_name: string | null;
    assignee_name: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
  unassigned_tickets: number;
}

export interface AdminDashboard {
  users: {
    total: number;
    active: number;
    recent: number;
    by_role: Record<string, number>;
  };
  projects: {
    total: number;
    active: number;
    archived: number;
  };
  tickets: {
    total: number;
    recent: number;
    by_status: Record<string, number>;
  };
  work_logs: {
    total: number;
    total_hours: number;
  };
  activity: {
    recent_count: number;
    by_type: Record<string, number>;
  };
}

export const dashboardApi = {
  getEmployeeDashboard: async (): Promise<EmployeeDashboard> => {
    const response = await api.get<EmployeeDashboard>('/dashboard/employee/');
    return response.data;
  },

  getManagerDashboard: async (): Promise<ManagerDashboard> => {
    const response = await api.get<ManagerDashboard>('/dashboard/manager/');
    return response.data;
  },

  getAdminDashboard: async (): Promise<AdminDashboard> => {
    const response = await api.get<AdminDashboard>('/dashboard/admin/');
    return response.data;
  },
};
