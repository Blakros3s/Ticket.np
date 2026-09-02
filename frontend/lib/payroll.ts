import axios from 'axios';
import api from './api';

export type PayrollRole =
  | 'developer'
  | 'designer'
  | 'qa'
  | 'manager'
  | 'office_staff'
  | 'contractor'
  | 'other';

export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type PayType = 'monthly' | 'hourly';
export type PayrollEmployeeStatus = 'active' | 'inactive' | 'terminated';
export type PaymentStatus = 'draft' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'qr';

export interface PayrollEmployee {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  role: PayrollRole;
  role_display: string;
  employment_type: EmploymentType;
  employment_type_display: string;
  pay_type: PayType;
  pay_type_display: string;
  base_rate: string;
  date_of_joining: string | null;
  date_of_leaving: string | null;
  status: PayrollEmployeeStatus;
  status_display: string;
  bank_name: string;
  bank_account_number: string;
  notes: string;
  has_payments: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollEmployeeInput {
  full_name: string;
  phone?: string;
  email?: string;
  address?: string;
  role: PayrollRole;
  employment_type: EmploymentType;
  pay_type: PayType;
  base_rate: string;
  date_of_joining?: string | null;
  date_of_leaving?: string | null;
  status: PayrollEmployeeStatus;
  bank_name?: string;
  bank_account_number?: string;
  notes?: string;
}

export interface PayrollEmployeeSummary {
  total_count: number;
  active_count: number;
  inactive_count: number;
  terminated_count: number;
  estimated_monthly_liability: string;
}

export interface SalaryPayment {
  id: number;
  employee: number;
  employee_name: string;
  employee_code: string;
  period_year: number;
  period_month: number;
  payment_date: string;
  base_amount: string;
  units_worked: string | null;
  allowances: string;
  overtime: string;
  bonus: string;
  deductions: string;
  gross_amount: string;
  net_amount: string;
  payment_method: PaymentMethod;
  payment_method_display: string;
  payment_status: PaymentStatus;
  payment_status_display: string;
  reference_number: string;
  notes: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentSummary {
  period_year: number;
  period_month: number;
  draft_count: number;
  paid_count: number;
  draft_total_net: string;
  paid_total_net: string;
  all_time_paid_total_net: string;
}

export interface PeriodStatusRow {
  employee: PayrollEmployee;
  payment_id: number | null;
  payment_status: PaymentStatus | null;
  units_worked: string | null;
  base_amount: string;
  allowances: string;
  overtime: string;
  bonus: string;
  deductions: string;
  gross_amount: string;
  net_amount: string;
  notes: string;
}

export interface PeriodStatus {
  period_year: number;
  period_month: number;
  rows: PeriodStatusRow[];
}

export interface BulkPayRowInput {
  employee_id: number;
  units_worked?: string | null;
  allowances?: string;
  overtime?: string;
  bonus?: string;
  deductions?: string;
  notes?: string;
}

export interface BulkPayInput {
  period_year: number;
  period_month: number;
  payment_date: string;
  payment_method: PaymentMethod;
  mark_paid: boolean;
  rows: BulkPayRowInput[];
}

const BASE = '/payroll';

export const payrollApi = {
  getEmployees: async (params?: Record<string, string | number>): Promise<PayrollEmployee[]> => {
    const response = await api.get<PayrollEmployee[]>(`${BASE}/employees/`, { params });
    return response.data;
  },

  getEmployee: async (id: number): Promise<PayrollEmployee> => {
    const response = await api.get<PayrollEmployee>(`${BASE}/employees/${id}/`);
    return response.data;
  },

  createEmployee: async (payload: PayrollEmployeeInput): Promise<PayrollEmployee> => {
    const response = await api.post<PayrollEmployee>(`${BASE}/employees/`, payload);
    return response.data;
  },

  updateEmployee: async (id: number, payload: Partial<PayrollEmployeeInput>): Promise<PayrollEmployee> => {
    const response = await api.patch<PayrollEmployee>(`${BASE}/employees/${id}/`, payload);
    return response.data;
  },

  deleteEmployee: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/employees/${id}/`);
  },

  getEmployeeSummary: async (): Promise<PayrollEmployeeSummary> => {
    const response = await api.get<PayrollEmployeeSummary>(`${BASE}/employees/summary/`);
    return response.data;
  },

  getPayments: async (params?: Record<string, string | number>): Promise<SalaryPayment[]> => {
    const response = await api.get<SalaryPayment[]>(`${BASE}/payments/`, { params });
    return response.data;
  },

  getPaymentSummary: async (year?: number, month?: number): Promise<PaymentSummary> => {
    const response = await api.get<PaymentSummary>(`${BASE}/payments/summary/`, {
      params: { year, month },
    });
    return response.data;
  },

  getPeriodStatus: async (year: number, month: number): Promise<PeriodStatus> => {
    const response = await api.get<PeriodStatus>(`${BASE}/payments/period-status/`, {
      params: { year, month },
    });
    return response.data;
  },

  bulkPay: async (payload: BulkPayInput): Promise<SalaryPayment[]> => {
    const response = await api.post<SalaryPayment[]>(`${BASE}/payments/bulk-pay/`, payload);
    return response.data;
  },

  markPaymentPaid: async (id: number): Promise<SalaryPayment> => {
    const response = await api.post<SalaryPayment>(`${BASE}/payments/${id}/mark-paid/`);
    return response.data;
  },

  cancelPayment: async (id: number): Promise<SalaryPayment> => {
    const response = await api.post<SalaryPayment>(`${BASE}/payments/${id}/cancel/`);
    return response.data;
  },

  exportPayments: async (year: number, month: number): Promise<void> => {
    try {
      const response = await api.get<Blob>(`${BASE}/payments/export/`, {
        params: { year, month },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filenameMatch = disposition?.match(/filename="?([^";\n]+)"?/i);
      const filename = filenameMatch?.[1] || `payroll_${year}_${String(month).padStart(2, '0')}.csv`;
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const payload = JSON.parse(text) as { detail?: string };
          throw new Error(payload.detail || 'Failed to export payroll.');
        } catch {
          throw new Error('Failed to export payroll.');
        }
      }
      throw error;
    }
  },
};

export function formatCurrency(value: string | number): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
