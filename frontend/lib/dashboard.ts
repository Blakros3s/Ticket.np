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

  getEmployeeReports: async (days: number = 30): Promise<EmployeeReports> => {
    const response = await api.get<EmployeeReports>(`/dashboard/reports/employee/?days=${days}`);
    return response.data;
  },

  getManagerReports: async (days: number = 30): Promise<ManagerReports> => {
    const response = await api.get<ManagerReports>(`/dashboard/reports/manager/?days=${days}`);
    return response.data;
  },

  getAdminReports: async (days: number = 30): Promise<AdminReports> => {
    const response = await api.get<AdminReports>(`/dashboard/reports/admin/?days=${days}`);
    return response.data;
  },
};

export interface EmployeeReports {
  tickets_created_over_time: Array<{ week: string; count: number }>;
  tickets_completed_over_time: Array<{ week: string; count: number }>;
  time_by_project: Array<{
    project_name: string;
    total_hours: number;
    session_count: number;
  }>;
  productivity: {
    total_assigned: number;
    total_completed: number;
    completion_rate: number;
    avg_resolution_hours: number;
  };
  time_trend: Array<{ date: string; hours: number }>;
  priority_distribution: Record<string, number>;
}

export interface ManagerReports {
  team_performance: Array<{
    user_id: number;
    user_name: string;
    assigned: number;
    completed: number;
    in_progress: number;
    total_hours: number;
  }>;
  project_progress: Array<{
    project_id: number;
    project_name: string;
    total_tickets: number;
    completed: number;
    progress: number;
  }>;
  ticket_trends: Array<{ week: string; [key: string]: any }>;
  resolution_by_priority: Array<{
    priority: string;
    avg_hours: number;
    count: number;
  }>;
  period_days: number;
}

export interface AdminReports {
  user_activity_trend: Array<{ date: string; count: number }>;
  ticket_volume_trend: Array<{ date: string; created: number; closed: number }>;
  project_health: Array<{
    project_id: number;
    project_name: string;
    total_tickets: number;
    open_tickets: number;
    overdue: number;
    health_score: number;
  }>;
  top_performers: Array<{
    user_id: number;
    user_name: string;
    tickets_closed: number;
    total_hours: number;
  }>;
  activity_breakdown: Record<string, number>;
  period_days: number;
  summary: {
    total_users: number;
    total_projects: number;
    total_tickets: number;
    total_hours_logged: number;
  };
}
