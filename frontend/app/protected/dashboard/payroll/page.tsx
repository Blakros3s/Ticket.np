'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatCurrency,
  monthLabel,
  payrollApi,
  PaymentSummary,
  PayrollEmployeeSummary,
} from '@/lib/payroll';
import {
  PayrollAccessDenied,
  PayrollLoading,
  PayrollPanel,
  PayrollQuickLink,
  PayrollShell,
  PayrollStatCard,
  usePayrollAdmin,
} from './payroll-ui';

export default function PayrollDashboardPage() {
  const { isAdmin, isLoading } = usePayrollAdmin();
  const [loading, setLoading] = useState(true);
  const [employeeSummary, setEmployeeSummary] = useState<PayrollEmployeeSummary | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [employees, payments] = await Promise.all([
          payrollApi.getEmployeeSummary(),
          payrollApi.getPaymentSummary(),
        ]);
        setEmployeeSummary(employees);
        setPaymentSummary(payments);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load payroll summary';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoading, isAdmin]);

  if (isLoading) return <PayrollLoading />;
  if (!isAdmin) return <PayrollAccessDenied />;

  const periodLabel = paymentSummary
    ? monthLabel(paymentSummary.period_year, paymentSummary.period_month)
    : '';

  return (
    <PayrollShell
      title="Payroll overview"
      subtitle="Manage your roster, process monthly salaries, and track payment history."
    >
      {error && (
        <div
          className="mb-6 rounded-xl px-4 py-3"
          style={{
            background: 'var(--danger-muted)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <PayrollLoading label="Loading summary…" />
      ) : (
        <>
          <div className="dashboard-kpi-grid">
            <PayrollStatCard
              label="Active employees"
              value={String(employeeSummary?.active_count ?? 0)}
              accent="dashboard-stat-accent-blue"
              href="/protected/dashboard/payroll/employees"
            />
            <PayrollStatCard
              label="Est. monthly liability"
              value={formatCurrency(employeeSummary?.estimated_monthly_liability ?? '0')}
              accent="dashboard-stat-accent-violet"
            />
            <PayrollStatCard
              label={`Paid in ${periodLabel}`}
              value={formatCurrency(paymentSummary?.paid_total_net ?? '0')}
              accent="dashboard-stat-accent-green"
              href="/protected/dashboard/payroll/payments"
            />
            <PayrollStatCard
              label="Draft payments"
              value={String(paymentSummary?.draft_count ?? 0)}
              accent="dashboard-stat-accent-amber"
              href="/protected/dashboard/payroll/payments"
            />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PayrollQuickLink
              href="/protected/dashboard/payroll/employees"
              title="Employees"
              description="Add staff to the payroll roster, set rates, and manage bank details."
              accent="bg-sky-500/15 text-sky-300"
            />
            <PayrollQuickLink
              href="/protected/dashboard/payroll/run"
              title="Run payroll"
              description="Process salaries for the month with allowances, overtime, and deductions."
              accent="bg-violet-500/15 text-violet-300"
            />
            <PayrollQuickLink
              href="/protected/dashboard/payroll/payments"
              title="Payments"
              description="Review payment history, mark drafts paid, cancel entries, and export CSV."
              accent="bg-emerald-500/15 text-emerald-300"
            />
          </div>

          <PayrollPanel title="At a glance">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat label="Total roster" value={String(employeeSummary?.total_count ?? 0)} />
              <MiniStat label="Inactive" value={String(employeeSummary?.inactive_count ?? 0)} />
              <MiniStat label="Terminated" value={String(employeeSummary?.terminated_count ?? 0)} />
              <MiniStat
                label="All-time paid"
                value={formatCurrency(paymentSummary?.all_time_paid_total_net ?? '0')}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/protected/dashboard/payroll/employees" className="btn-primary">
                Add employee
              </Link>
              <Link href="/protected/dashboard/payroll/run" className="btn-secondary">
                Run this month&apos;s payroll
              </Link>
            </div>
          </PayrollPanel>
        </>
      )}
    </PayrollShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-inner-card px-4 py-3">
      <p className="meta-text text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
