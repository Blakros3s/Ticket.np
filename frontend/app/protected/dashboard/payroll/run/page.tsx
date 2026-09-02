'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  formatCurrency,
  monthLabel,
  PaymentMethod,
  payrollApi,
  PeriodStatusRow,
} from '@/lib/payroll';

interface EditableRow extends PeriodStatusRow {
  selected: boolean;
}

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function RunPayrollPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const initial = currentPeriod();

  const [periodYear, setPeriodYear] = useState(initial.year);
  const [periodMonth, setPeriodMonth] = useState(initial.month);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPeriod = useCallback(async () => {
    try {
      setLoading(true);
      const data = await payrollApi.getPeriodStatus(periodYear, periodMonth);
      setRows(
        data.rows.map((row) => ({
          ...row,
          selected: row.payment_status !== 'paid',
        })),
      );
    } catch {
      showToast('Failed to load pay run', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodYear, periodMonth]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    loadPeriod();
  }, [authLoading, isAdmin, loadPeriod]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + Number(row.net_amount), 0),
    [selectedRows],
  );

  const updateRow = (employeeId: number, patch: Partial<EditableRow>) => {
    setRows((current) =>
      current.map((row) => {
        if (row.employee.id !== employeeId) return row;
        const next = { ...row, ...patch };
        const base =
          next.employee.pay_type === 'hourly'
            ? Number(next.employee.base_rate) * Number(next.units_worked || 0)
            : Number(next.employee.base_rate);
        const gross =
          base +
          Number(next.allowances) +
          Number(next.overtime) +
          Number(next.bonus);
        const net = Math.max(0, gross - Number(next.deductions));
        return {
          ...next,
          base_amount: base.toFixed(2),
          gross_amount: gross.toFixed(2),
          net_amount: net.toFixed(2),
        };
      }),
    );
  };

  const submit = async (markPaid: boolean) => {
    if (selectedRows.length === 0) {
      showToast('Select at least one employee', 'error');
      return;
    }
    const invalidHourly = selectedRows.find(
      (row) => row.employee.pay_type === 'hourly' && !row.units_worked,
    );
    if (invalidHourly) {
      showToast(`Enter hours worked for ${invalidHourly.employee.full_name}`, 'error');
      return;
    }
    try {
      setSubmitting(true);
      await payrollApi.bulkPay({
        period_year: periodYear,
        period_month: periodMonth,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        mark_paid: markPaid,
        rows: selectedRows.map((row) => ({
          employee_id: row.employee.id,
          units_worked: row.units_worked,
          allowances: row.allowances,
          overtime: row.overtime,
          bonus: row.bonus,
          deductions: row.deductions,
          notes: row.notes,
        })),
      });
      showToast(markPaid ? 'Payroll marked as paid' : 'Payroll saved as draft', 'success');
      loadPeriod();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      showToast(err.response?.data?.detail || 'Failed to process payroll', 'error');
    } finally {
      setSubmitting(false);
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
          <p className="text-sm text-slate-400 mb-1"><Link href="/protected/dashboard/payroll">Payroll</Link> / Run</p>
          <h1 className="dashboard-title">Run payroll</h1>
          <p className="dashboard-subtitle">{monthLabel(periodYear, periodMonth)}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={submitting} onClick={() => submit(false)}>
            Save draft
          </button>
          <button type="button" className="btn-primary" disabled={submitting} onClick={() => submit(true)}>
            Pay selected
          </button>
        </div>
      </div>

      <div className="glass-card p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="text-sm text-slate-400">Year</span>
          <input className="input-field" type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Month</span>
          <input className="input-field" type="number" min={1} max={12} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Payment date</span>
          <input className="input-field" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Payment method</span>
          <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="qr">QR</option>
          </select>
        </label>
      </div>

      <div className="glass-card p-4 mb-4 flex justify-between items-center">
        <p className="text-slate-300">{selectedRows.length} selected</p>
        <p className="text-white font-semibold">Total net: {formatCurrency(selectedTotal.toFixed(2))}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" /></div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="p-3">Select</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Allowances</th>
                <th className="p-3">Overtime</th>
                <th className="p-3">Bonus</th>
                <th className="p-3">Deductions</th>
                <th className="p-3">Net</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee.id} className="border-b border-white/5">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={row.payment_status === 'paid'}
                      onChange={(e) => updateRow(row.employee.id, { selected: e.target.checked })}
                    />
                  </td>
                  <td className="p-3">
                    <div className="text-white">{row.employee.full_name}</div>
                    <div className="text-xs text-slate-400">{row.employee.employee_code}</div>
                  </td>
                  <td className="p-3">
                    {row.employee.pay_type === 'hourly' ? (
                      <input
                        className="input-field w-24"
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.units_worked ?? ''}
                        disabled={row.payment_status === 'paid'}
                        onChange={(e) => updateRow(row.employee.id, { units_worked: e.target.value })}
                      />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  {(['allowances', 'overtime', 'bonus', 'deductions'] as const).map((field) => (
                    <td className="p-3" key={field}>
                      <input
                        className="input-field w-24"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row[field]}
                        disabled={row.payment_status === 'paid'}
                        onChange={(e) => updateRow(row.employee.id, { [field]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td className="p-3 text-white font-medium">{formatCurrency(row.net_amount)}</td>
                  <td className="p-3 capitalize text-slate-300">{row.payment_status || 'pending'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">No active employees for this period.</td></tr>
              )}
            </tbody>
          </table>
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
