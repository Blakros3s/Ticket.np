'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  formatCurrency,
  monthLabel,
  PaymentStatus,
  payrollApi,
  SalaryPayment,
} from '@/lib/payroll';

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function PayrollPaymentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const initial = currentPeriod();

  const [periodYear, setPeriodYear] = useState(initial.year);
  const [periodMonth, setPeriodMonth] = useState(initial.month);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        period_year: periodYear,
        period_month: periodMonth,
      };
      if (statusFilter !== 'all') params.payment_status = statusFilter;
      const data = await payrollApi.getPayments(params);
      setPayments(data);
    } catch {
      showToast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodYear, periodMonth, statusFilter]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    fetchPayments();
  }, [authLoading, isAdmin, fetchPayments]);

  const handleMarkPaid = async (payment: SalaryPayment) => {
    try {
      await payrollApi.markPaymentPaid(payment.id);
      showToast('Payment marked as paid', 'success');
      fetchPayments();
    } catch {
      showToast('Failed to mark payment as paid', 'error');
    }
  };

  const handleCancel = async (payment: SalaryPayment) => {
    if (!window.confirm(`Cancel payment for ${payment.employee_name}?`)) return;
    try {
      await payrollApi.cancelPayment(payment.id);
      showToast('Payment cancelled', 'success');
      fetchPayments();
    } catch {
      showToast('Failed to cancel payment', 'error');
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await payrollApi.exportPayments(periodYear, periodMonth);
      showToast('CSV exported', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export CSV';
      showToast(message, 'error');
    } finally {
      setExporting(false);
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
          <p className="text-sm text-slate-400 mb-1"><Link href="/protected/dashboard/payroll">Payroll</Link> / Payments</p>
          <h1 className="dashboard-title">Payment history</h1>
          <p className="dashboard-subtitle">{monthLabel(periodYear, periodMonth)}</p>
        </div>
        <button type="button" className="btn-secondary" disabled={exporting} onClick={handleExport}>
          Export CSV
        </button>
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
        <label className="block md:col-span-2">
          <span className="text-sm text-slate-400">Status</span>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" /></div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="p-4">Employee</th>
                <th className="p-4">Period</th>
                <th className="p-4">Payment date</th>
                <th className="p-4">Gross</th>
                <th className="p-4">Net</th>
                <th className="p-4">Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-white/5">
                  <td className="p-4">
                    <div className="text-white">{payment.employee_name}</div>
                    <div className="text-xs text-slate-400">{payment.employee_code}</div>
                  </td>
                  <td className="p-4">{payment.period_year}-{String(payment.period_month).padStart(2, '0')}</td>
                  <td className="p-4">{payment.payment_date}</td>
                  <td className="p-4">{formatCurrency(payment.gross_amount)}</td>
                  <td className="p-4 font-medium text-white">{formatCurrency(payment.net_amount)}</td>
                  <td className="p-4">{payment.payment_method_display}</td>
                  <td className="p-4 capitalize">{payment.payment_status_display}</td>
                  <td className="p-4 space-x-2">
                    {payment.payment_status === 'draft' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => handleMarkPaid(payment)}>Mark paid</button>
                    )}
                    {payment.payment_status !== 'cancelled' && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => handleCancel(payment)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No payments for this period.</td></tr>
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
