'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  EmployeeAvatar,
  EmployeeStatusBadge,
  PayrollAccessDenied,
  PayrollEmptyState,
  PayrollField,
  PayrollLoading,
  PayrollModal,
  PayrollPanel,
  PayrollShell,
  PayrollTable,
  PayrollTableBody,
  PayrollTableHead,
  PayrollToast,
  PayrollToolbar,
  usePayrollAdmin,
  usePayrollToast,
} from '../payroll-ui';

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
  const { isAdmin, isLoading } = usePayrollAdmin();
  const { toast, showToast } = usePayrollToast();
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PayrollEmployeeStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | null>(null);
  const [form, setForm] = useState<PayrollEmployeeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
  }, [statusFilter, showToast]);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetchEmployees();
  }, [isLoading, isAdmin, fetchEmployees]);

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

  const activeCount = employees.filter((employee) => employee.status === 'active').length;

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
      setSaving(true);
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
        showToast('Employee added to payroll', 'success');
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
    } finally {
      setSaving(false);
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

  if (isLoading) return <PayrollLoading />;
  if (!isAdmin) return <PayrollAccessDenied />;

  return (
    <PayrollShell
      title="Payroll employees"
      subtitle={`${activeCount} active on roster`}
      breadcrumb={[{ label: 'Employees' }]}
      actions={
        <button type="button" className="btn-primary" onClick={openCreate}>
          Add employee
        </button>
      }
    >
      <PayrollToolbar>
        <PayrollField label="Search">
          <input
            className="input-field"
            placeholder="Name, code, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </PayrollField>
        <PayrollField label="Status" className="md:max-w-[200px]">
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </PayrollField>
      </PayrollToolbar>

      <PayrollPanel
        title="Roster"
        description="Standalone payroll staff — not linked to app login users."
      >
        {loading ? (
          <PayrollLoading label="Loading employees…" />
        ) : filtered.length === 0 ? (
          <PayrollEmptyState
            title="No employees yet"
            description="Add your first payroll employee to start running monthly salaries."
            action={
              <button type="button" className="btn-primary" onClick={openCreate}>
                Add employee
              </button>
            }
          />
        ) : (
          <PayrollTable>
            <PayrollTableHead>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Pay type</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </PayrollTableHead>
            <PayrollTableBody>
              {filtered.map((employee) => (
                <tr key={employee.id} className="transition-colors hover:bg-slate-700/20">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={employee.full_name} />
                      <div>
                        <p className="font-medium text-white">{employee.full_name}</p>
                        <p className="font-mono text-xs text-sky-300">{employee.employee_code}</p>
                        {(employee.phone || employee.email) && (
                          <p className="meta-text mt-0.5 text-xs">
                            {[employee.phone, employee.email].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{employee.role_display}</td>
                  <td className="px-4 py-4 text-slate-300">{employee.pay_type_display}</td>
                  <td className="px-4 py-4 font-medium text-white">{formatCurrency(employee.base_rate)}</td>
                  <td className="px-4 py-4">
                    <EmployeeStatusBadge status={employee.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(employee)}>
                        Edit
                      </button>
                      {employee.status === 'active' && (
                        <button type="button" className="btn-secondary text-xs" onClick={() => handleDeactivate(employee)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </PayrollTableBody>
          </PayrollTable>
        )}
      </PayrollPanel>

      {showModal && (
        <PayrollModal
          title={editing ? 'Edit employee' : 'Add employee'}
          description="Payroll roster entry — separate from app login users."
          onClose={() => setShowModal(false)}
          size="xl"
        >
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Full name" required>
              <input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </FormField>
            <FormField label="Role">
              <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PayrollRole })}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <FormField label="Phone"><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
            <FormField label="Email"><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <FormField label="Employment type">
              <select className="input-field" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
              </select>
            </FormField>
            <FormField label="Pay type">
              <select className="input-field" value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value as PayType })}>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </FormField>
            <FormField label={form.pay_type === 'hourly' ? 'Hourly rate' : 'Monthly salary'} required>
              <input className="input-field" required type="number" min="0" step="0.01" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PayrollEmployeeStatus })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </FormField>
            <FormField label="Date of joining"><input className="input-field" type="date" value={form.date_of_joining || ''} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} /></FormField>
            <FormField label="Date of leaving"><input className="input-field" type="date" value={form.date_of_leaving || ''} onChange={(e) => setForm({ ...form, date_of_leaving: e.target.value })} /></FormField>
            <FormField label="Bank name"><input className="input-field" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></FormField>
            <FormField label="Bank account"><input className="input-field" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></FormField>
            <div className="md:col-span-2">
              <FormField label="Address"><textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notes"><textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 border-t border-slate-700/50 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
              </button>
            </div>
          </form>
        </PayrollModal>
      )}

      {toast && <PayrollToast message={toast.message} type={toast.type} />}
    </PayrollShell>
  );
}

function FormField({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}
