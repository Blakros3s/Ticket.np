import api from './api';

export interface UserRole {
  id: number;
  name: string;
  display_name: string;
  color: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'employee' | 'manager';
  department_roles: UserRole[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register/', data);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<{ access: string; refresh: string }> => {
    const response = await api.post<{ access: string; refresh: string }>('/auth/token/refresh/', {
      refresh: refreshToken,
    });
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/profile/');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.patch<User>('/auth/profile/', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getUsers: async (): Promise<User[]> => {
    const response = await api.get<{ results: User[] }>('/auth/users/');
    return response.data.results;
  },

  deactivateUser: async (userId: number): Promise<void> => {
    await api.post(`/auth/users/${userId}/deactivate/`);
  },
  deleteUser: async (userId: number): Promise<void> => {
    await api.delete(`/auth/users/${userId}/`);
  },

  // Admin: create a new user
  createUser: async (data: {
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role?: 'admin' | 'employee' | 'manager';
    department_role_ids?: number[];
    password: string;
    confirm_password?: string;
  }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/users/', data);
    return response.data;
  },

  // Admin: update an existing user
  updateUser: async (
    userId: number,
    data: Partial<{
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      role: 'admin' | 'employee' | 'manager';
      department_role_ids: number[];
      is_active: boolean;
    }>
  ): Promise<any> => {
    const response = await api.patch(`/auth/users/${userId}/`, data);
    return response.data;
  },

  // Get all department roles
  getDepartmentRoles: async (): Promise<UserRole[]> => {
    const response = await api.get<UserRole[] | { results: UserRole[] }>('/auth/department-roles/');
    console.log('API response for department roles:', response.data);
    // Handle both direct array and wrapped response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  },

  // Admin: create a new department role
  createDepartmentRole: async (data: {
    name: string;
    display_name: string;
    color: string;
  }): Promise<UserRole> => {
    const response = await api.post<UserRole>('/auth/department-roles/', data);
    return response.data;
  },

  // Admin: update a department role
  updateDepartmentRole: async (
    roleId: number,
    data: Partial<{
      name: string;
      display_name: string;
      color: string;
    }>
  ): Promise<UserRole> => {
    const response = await api.patch<UserRole>(`/auth/department-roles/${roleId}/`, data);
    return response.data;
  },

  // Admin: delete a department role
  deleteDepartmentRole: async (roleId: number): Promise<void> => {
    await api.delete(`/auth/department-roles/${roleId}/`);
  },
};
