'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  EmploymentType,
  formatCurrency,
  PayType,
  PayrollEmployee,
  PayrollEmployeeInput,
  PayrollEmployeeStatus,
  PayrollRole,
  payrollApi,
} from '@/lib/payroll';

const ROLE_OPTIONS: { value: PayrollRole; label: string }[] = [
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'qa', label: 'QA' },
  { value: 'manager', label: 'Manager' },
  { value: 'office_staff', label: 'Office staff' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM: PayrollEmployeeInput = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  role: 'developer',
  employment_type: 'full_time',
  pay_type: 'monthly',
  base_rate: '',
  date_of_joining: '',
  date_of_leaving: '',
  status: 'active',
  bank_name: '',
  bank_account_number: '',
  notes: '',
};

export default function PayrollEmployeesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PayrollEmployeeStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | null>(null);
  const [form, setForm] = useState<PayrollEmployeeInput>(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await payrollApi.getEmployees(
        statusFilter === 'all' ? undefined : { status: statusFilter },
      );
      setEmployees(data);
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    fetchEmployees();
  }, [authLoading, isAdmin, fetchEmployees]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      [employee.full_name, employee.employee_code, employee.phone, employee.email]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [employees, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (employee: PayrollEmployee) => {
    setEditing(employee);
    setForm({
      full_name: employee.full_name,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      role: employee.role,
      employment_type: employee.employment_type,
      pay_type: employee.pay_type,
      base_rate: employee.base_rate,
      date_of_joining: employee.date_of_joining || '',
      date_of_leaving: employee.date_of_leaving || '',
      status: employee.status,
      bank_name: employee.bank_name,
      bank_account_number: employee.bank_account_number,
      notes: employee.notes,
    });
    setShowModal(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload: PayrollEmployeeInput = {
        ...form,
        date_of_joining: form.date_of_joining || null,
        date_of_leaving: form.date_of_leaving || null,
      };
      if (editing) {
        await payrollApi.updateEmployee(editing.id, payload);
        showToast('Employee updated', 'success');
      } else {
        await payrollApi.createEmployee(payload);
        showToast('Employee added', 'success');
      }
      setShowModal(false);
      fetchEmployees();
    } catch (error: unknown) {
      const err = error as { response?: { data?: Record<string, string[] | string> } };
      const data = err.response?.data;
      const message =
        (typeof data?.detail === 'string' && data.detail) ||
        (Array.isArray(data?.full_name) && data.full_name[0]) ||
        'Failed to save employee';
      showToast(message, 'error');
    }
  };

  const handleDeactivate = async (employee: PayrollEmployee) => {
    if (!window.confirm(`Deactivate ${employee.full_name}?`)) return;
    try {
      await payrollApi.deleteEmployee(employee.id);
      showToast(employee.has_payments ? 'Employee deactivated' : 'Employee removed', 'success');
      fetchEmployees();
    } catch {
      showToast('Failed to deactivate employee', 'error');
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <Link href="/protected/dashboard" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <p className="text-sm text-slate-400 mb-1"><Link href="/protected/dashboard/payroll">Payroll</Link> / Employees</p>
          <h1 className="dashboard-title">Payroll employees</h1>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>Add employee</button>
      </div>

      <div className="glass-card p-4 mb-6 flex flex-col md:flex-row gap-3">
        <input
          className="input-field flex-1"
          placeholder="Search by name, code, phone, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input-field md:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" /></div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="p-4">Code</th>
                <th className="p-4">Name</th>
                <th className="p-4">Role</th>
                <th className="p-4">Pay</th>
                <th className="p-4">Rate</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 font-mono text-sky-300">{employee.employee_code}</td>
                  <td className="p-4 text-white">{employee.full_name}</td>
                  <td className="p-4">{employee.role_display}</td>
                  <td className="p-4">{employee.pay_type_display}</td>
                  <td className="p-4">{formatCurrency(employee.base_rate)}</td>
                  <td className="p-4"><StatusBadge status={employee.status} /></td>
                  <td className="p-4 space-x-2">
                    <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(employee)}>Edit</button>
                    {employee.status === 'active' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => handleDeactivate(employee)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{editing ? 'Edit employee' : 'Add employee'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </Field>
              <Field label="Role">
                <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PayrollRole })}>
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Phone"><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Employment type">
                <select className="input-field" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}>
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                </select>
              </Field>
              <Field label="Pay type">
                <select className="input-field" value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value as PayType })}>
                  <option value="monthly">Monthly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </Field>
              <Field label={form.pay_type === 'hourly' ? 'Hourly rate' : 'Monthly salary'} required>
                <input className="input-field" required type="number" min="0" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PayrollEmployeeStatus })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </Field>
              <Field label="Date of joining"><input className="input-field" type="date" value={form.date_of_joining || ''} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} /></Field>
              <Field label="Date of leaving"><input className="input-field" type="date" value={form.date_of_leaving || ''} onChange={(e) => setForm({ ...form, date_of_leaving: e.target.value })} /></Field>
              <Field label="Bank name"><input className="input-field" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
              <Field label="Bank account"><input className="input-field" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></Field>
              <div className="md:col-span-2">
                <Field label="Address"><textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Notes"><textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editing ? 'Save changes' : 'Add employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300 mb-1 block">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: PayrollEmployeeStatus }) {
  const classes =
    status === 'active' ? 'text-emerald-300 bg-emerald-500/10' :
    status === 'terminated' ? 'text-red-300 bg-red-500/10' :
    'text-amber-300 bg-amber-500/10';
  return <span className={`px-2 py-1 rounded text-xs capitalize ${classes}`}>{status}</span>;
}
