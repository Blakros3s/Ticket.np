import platformApi from './platform-api';

export interface Plan {
  id: number;
  name: string;
  tier: 'standard' | 'premium';
  monthly_price: string;
  max_users: number;
  max_projects: number;
  attendance_enabled: boolean;
  calendar_enabled: boolean;
  email_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionSummary {
  plan_id: number;
  plan_name: string;
  plan_tier: string;
  status: string;
  expires_at: string | null;
  is_effectively_expired: boolean;
}

export interface SubscriptionDetail extends SubscriptionSummary {
  started_at: string;
  notes: string;
  limits: {
    max_users: number;
    max_projects: number;
    attendance_enabled: boolean;
    calendar_enabled: boolean;
    email_notifications_enabled: boolean;
  };
  usage: Record<string, number>;
}

export interface TenantListItem {
  id: number;
  name: string;
  slug: string;
  schema_name: string;
  login_domain: string;
  is_active: boolean;
  primary_domain: string | null;
  user_count: number;
  subscription: SubscriptionSummary | null;
  created_at: string;
  updated_at: string;
}

export interface TenantDetail extends TenantListItem {
  domains: Array<{ id: number; domain: string; is_primary: boolean }>;
  subscription: SubscriptionDetail | null;
}

export interface TenantUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  login_domain?: string;
  admin_username: string;
  admin_password: string;
  admin_email?: string;
  admin_first_name?: string;
  admin_last_name?: string;
  plan_id?: number | null;
}

export interface CreateTenantUserInput {
  username: string;
  password: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'admin' | 'manager' | 'employee';
}

export const serverApi = {
  getTenants: async (): Promise<TenantListItem[]> => {
    const response = await platformApi.get<TenantListItem[]>('tenants/');
    return response.data;
  },

  getTenant: async (id: number): Promise<TenantDetail> => {
    const response = await platformApi.get<TenantDetail>(`tenants/${id}/`);
    return response.data;
  },

  createTenant: async (data: CreateTenantInput): Promise<TenantDetail> => {
    const response = await platformApi.post<TenantDetail>('tenants/', data);
    return response.data;
  },

  updateTenant: async (
    id: number,
    data: Partial<{ name: string; is_active: boolean; login_domain: string }>
  ): Promise<TenantDetail> => {
    const response = await platformApi.patch<TenantDetail>(`tenants/${id}/`, data);
    return response.data;
  },

  deactivateTenant: async (id: number): Promise<void> => {
    await platformApi.delete(`tenants/${id}/`);
  },

  reactivateTenant: async (id: number): Promise<TenantDetail> => {
    const response = await platformApi.post<TenantDetail>(`tenants/${id}/reactivate/`);
    return response.data;
  },

  purgeTenant: async (id: number, data: { password: string; slug: string }): Promise<void> => {
    await platformApi.post(`tenants/${id}/purge/`, data);
  },

  assignPlan: async (
    id: number,
    data: { plan_id: number; expires_at?: string | null; notes?: string }
  ): Promise<TenantDetail> => {
    const response = await platformApi.post<TenantDetail>(`tenants/${id}/assign-plan/`, data);
    return response.data;
  },

  getTenantUsers: async (tenantId: number): Promise<TenantUser[]> => {
    const response = await platformApi.get<TenantUser[]>(`tenants/${tenantId}/users/`);
    return response.data;
  },

  createTenantUser: async (tenantId: number, data: CreateTenantUserInput): Promise<TenantUser> => {
    const response = await platformApi.post<TenantUser>(`tenants/${tenantId}/users/`, data);
    return response.data;
  },

  resetTenantUserPassword: async (
    tenantId: number,
    userId: number,
    password: string
  ): Promise<void> => {
    await platformApi.post(`tenants/${tenantId}/users/${userId}/reset-password/`, { password });
  },

  getPlans: async (): Promise<Plan[]> => {
    const response = await platformApi.get<Plan[] | { results: Plan[] }>('plans/');
    return Array.isArray(response.data) ? response.data : response.data.results;
  },

  updatePlan: async (id: number, data: Partial<Plan>): Promise<Plan> => {
    const response = await platformApi.patch<Plan>(`plans/${id}/`, data);
    return response.data;
  },
};
