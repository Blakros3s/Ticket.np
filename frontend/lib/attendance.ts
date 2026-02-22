import api from './api';

export interface OfficeSettings {
  id: number;
  office_start_time: string;
  office_end_time: string;
  auto_mark_absent: boolean;
  is_within_office_hours: boolean;
  has_office_hours_ended: boolean;
  updated_at: string;
}

export interface LeaveRequest {
  id: number;
  employee: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  start_date: string;
  end_date: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  approved_at?: string;
  rejection_reason?: string;
  duration_days: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLog {
  id: number;
  status: 'available' | 'unavailable';
  status_display: string;
  timestamp: string;
  time_display: string;
  is_auto: boolean;
  note: string;
}

export interface Attendance {
  id: number;
  employee: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  date: string;
  status: 'neutral' | 'present' | 'leave' | 'absent';
  current_availability: 'available' | 'unavailable' | 'none';
  first_available_at?: string;
  first_available_time?: string;
  last_changed_at?: string;
  is_available: boolean;
  visibility_status: 'available' | 'unavailable' | 'hidden';
  can_toggle_status: boolean;
  toggle_status_message?: string;
  daily_logs: AttendanceLog[];
  formatted_summary: string;
  created_at: string;
}

export interface TeamAttendance {
  id: number;
  employee_name: string;
  employee_username: string;
  employee_role: string;
  department_roles: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  date: string;
  status: 'neutral' | 'present' | 'leave' | 'absent';
  current_availability: 'available' | 'unavailable' | 'none';
  is_available: boolean;
  visibility_status: 'available' | 'unavailable' | 'hidden';
  last_changed_time?: string;
}

export interface AttendanceStats {
  username?: string;
  range: { start: string; end: string };
  total_working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  percentage: number;
  stats?: Array<{
    employee_id: number;
    username: string;
    full_name: string;
    present_days: number;
    absent_days: number;
    leave_days: number;
    working_days: number;
    percentage: number;
  }>;
}

export const attendanceApi = {
  // Office Settings
  getOfficeSettings: async (): Promise<OfficeSettings> => {
    const response = await api.get<OfficeSettings>('/attendance/settings/');
    return response.data;
  },

  updateOfficeSettings: async (data: {
    office_start_time: string;
    office_end_time: string;
    auto_mark_absent: boolean;
  }): Promise<OfficeSettings> => {
    const response = await api.put<OfficeSettings>('/attendance/settings/', data);
    return response.data;
  },

  // Leave Requests
  getLeaveRequests: async (): Promise<LeaveRequest[]> => {
    const response = await api.get<LeaveRequest[]>('/attendance/leave-requests/');
    return Array.isArray(response.data) ? response.data : [];
  },

  getMyLeaveRequests: async (): Promise<LeaveRequest[]> => {
    const response = await api.get<LeaveRequest[]>('/attendance/leave-requests/my/');
    return Array.isArray(response.data) ? response.data : [];
  },

  createLeaveRequest: async (data: {
    start_date: string;
    end_date: string;
    message: string;
  }): Promise<LeaveRequest> => {
    const response = await api.post<LeaveRequest>('/attendance/leave-requests/', data);
    return response.data;
  },

  deleteLeaveRequest: async (id: number): Promise<void> => {
    await api.delete(`/attendance/leave-requests/${id}/`);
  },

  updateLeaveRequest: async (id: number, data: Partial<{ start_date: string, end_date: string, message: string }>): Promise<LeaveRequest> => {
    const response = await api.patch(`/attendance/leave-requests/${id}/`, data);
    return response.data;
  },

  approveLeaveRequest: async (id: number): Promise<void> => {
    await api.post(`/attendance/leave-requests/${id}/approve/`);
  },

  rejectLeaveRequest: async (id: number, reason?: string): Promise<void> => {
    await api.post(`/attendance/leave-requests/${id}/reject/`, { reason });
  },

  // Attendance
  getMyAttendance: async (): Promise<Attendance> => {
    const response = await api.get<Attendance>('/attendance/attendance/me/');
    return response.data;
  },

  getAttendanceHistory: async (startDate?: string, endDate?: string): Promise<Attendance[]> => {
    const params: { start_date?: string; end_date?: string } = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get<Attendance[]>('/attendance/attendance/', { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  toggleAvailability: async (status: 'available' | 'unavailable', date?: string): Promise<Attendance> => {
    const data = { status, ...(date && { date }) };
    const response = await api.post<Attendance>('/attendance/attendance/', data);
    return response.data;
  },

  // Admin/Manager: Get daily attendance logs
  getDailyAttendanceLogs: async (date?: string): Promise<{
    summary: {
      date: string;
      total_employees: number;
      present_count: number;
      absent_count: number;
      leave_count: number;
      neutral_count: number;
      available_now: number;
    };
    records: Array<Attendance & {
      logs: AttendanceLog[];
      total_duration_available?: string;
    }>;
  }> => {
    const params: { date?: string } = {};
    if (date) params.date = date;
    const response = await api.get('/attendance/attendance/logs/', { params });
    return response.data;
  },

  // Team Availability
  getTeamAttendance: async (): Promise<TeamAttendance[]> => {
    const response = await api.get<TeamAttendance[]>('/attendance/attendance/team/');
    return Array.isArray(response.data) ? response.data : [];
  },

  // Attendance Stats
  getAttendanceStats: async (params: { start_date?: string; end_date?: string; all_employees?: boolean; employee_id?: number }): Promise<AttendanceStats> => {
    const response = await api.get<AttendanceStats>('/attendance/attendance/stats/', { params });
    return response.data;
  },
};
