'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatCurrency,
  monthLabel,
  PaymentStatus,
  payrollApi,
  SalaryPayment,
} from '@/lib/payroll';
import {
  EmployeeAvatar,
  PaymentStatusBadge,
  PayrollAccessDenied,
  PayrollActionButton,
  PayrollEmptyState,
  PayrollField,
  PayrollLoading,
  PayrollPanel,
  PayrollShell,
  PayrollTable,
  PayrollTableBody,
  PayrollTableHead,
  PayrollToast,
  PayrollToolbar,
  PeriodFields,
  usePayrollAdmin,
  usePayrollToast,
} from '../payroll-ui';

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function PayrollPaymentsPage() {
  const { isAdmin, isLoading } = usePayrollAdmin();
  const { toast, showToast } = usePayrollToast();
  const initial = currentPeriod();

  const [periodYear, setPeriodYear] = useState(initial.year);
  const [periodMonth, setPeriodMonth] = useState(initial.month);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
  }, [periodYear, periodMonth, statusFilter, showToast]);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    fetchPayments();
  }, [isLoading, isAdmin, fetchPayments]);

  const totals = useMemo(() => {
    const paid = payments.filter((payment) => payment.payment_status === 'paid');
    const draft = payments.filter((payment) => payment.payment_status === 'draft');
    const sum = (items: SalaryPayment[]) =>
      items.reduce((total, payment) => total + Number(payment.net_amount), 0);
    return {
      paidCount: paid.length,
      draftCount: draft.length,
      paidTotal: sum(paid),
      draftTotal: sum(draft),
    };
  }, [payments]);

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

  if (isLoading) return <PayrollLoading />;
  if (!isAdmin) return <PayrollAccessDenied />;

  return (
    <PayrollShell
      title="Payment history"
      subtitle={monthLabel(periodYear, periodMonth)}
      breadcrumb={[{ label: 'Payments' }]}
      actions={
        <button type="button" className="btn-secondary" disabled={exporting} onClick={handleExport}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      }
    >
      <PayrollToolbar>
        <PeriodFields
          year={periodYear}
          month={periodMonth}
          onYearChange={setPeriodYear}
          onMonthChange={setPeriodMonth}
        />
        <PayrollField label="Status" className="md:max-w-[200px]">
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </PayrollField>
      </PayrollToolbar>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <p className="stat-card-label">Paid</p>
          <p className="stat-card-value dashboard-stat-accent-green">{totals.paidCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Paid total</p>
          <p className="stat-card-value dashboard-stat-accent-green">{formatCurrency(totals.paidTotal.toFixed(2))}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Drafts</p>
          <p className="stat-card-value dashboard-stat-accent-amber">{totals.draftCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Draft total</p>
          <p className="stat-card-value dashboard-stat-accent-amber">{formatCurrency(totals.draftTotal.toFixed(2))}</p>
        </div>
      </div>

      <PayrollPanel title="Payments" description="Filter by period and status. Export includes paid rows only.">
        {loading ? (
          <PayrollLoading label="Loading payments…" />
        ) : payments.length === 0 ? (
          <PayrollEmptyState
            title="No payments for this period"
            description="Run payroll for the selected month or adjust your filters."
          />
        ) : (
          <PayrollTable>
            <PayrollTableHead>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Payment date</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </PayrollTableHead>
            <PayrollTableBody>
              {payments.map((payment) => (
                <tr key={payment.id} className="transition-colors hover:bg-slate-700/20">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={payment.employee_name} />
                      <div>
                        <p className="font-medium text-white">{payment.employee_name}</p>
                        <p className="font-mono text-xs text-sky-300">{payment.employee_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {payment.period_year}-{String(payment.period_month).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-4 text-slate-300">{payment.payment_date}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCurrency(payment.gross_amount)}</td>
                  <td className="px-4 py-4 font-semibold text-white">{formatCurrency(payment.net_amount)}</td>
                  <td className="px-4 py-4 text-slate-300">{payment.payment_method_display}</td>
                  <td className="px-4 py-4">
                    <PaymentStatusBadge status={payment.payment_status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      {payment.payment_status === 'draft' && (
                        <PayrollActionButton variant="success" onClick={() => handleMarkPaid(payment)}>
                          Mark paid
                        </PayrollActionButton>
                      )}
                      {payment.payment_status !== 'cancelled' && (
                        <PayrollActionButton variant="danger" onClick={() => handleCancel(payment)}>
                          Cancel
                        </PayrollActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </PayrollTableBody>
          </PayrollTable>
        )}
      </PayrollPanel>

      {toast && <PayrollToast message={toast.message} type={toast.type} />}
    </PayrollShell>
  );
}
