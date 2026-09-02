'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  formatCurrency,
  monthLabel,
  payrollApi,
  PaymentSummary,
  PayrollEmployeeSummary,
} from '@/lib/payroll';

export default function PayrollDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [employeeSummary, setEmployeeSummary] = useState<PayrollEmployeeSummary | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
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
  }, [authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-6">You don&apos;t have permission to access payroll.</p>
          <Link href="/protected/dashboard" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Payroll</h1>
          <p className="dashboard-subtitle">Manage employees, run monthly payroll, and track payments.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard label="Active employees" value={String(employeeSummary?.active_count ?? 0)} />
            <StatCard
              label="Est. monthly liability"
              value={formatCurrency(employeeSummary?.estimated_monthly_liability ?? '0')}
            />
            <StatCard
              label={`Paid this month (${paymentSummary ? monthLabel(paymentSummary.period_year, paymentSummary.period_month) : ''})`}
              value={formatCurrency(paymentSummary?.paid_total_net ?? '0')}
            />
            <StatCard
              label="Draft this month"
              value={String(paymentSummary?.draft_count ?? 0)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NavCard
              href="/protected/dashboard/payroll/employees"
              title="Employees"
              description="Add and manage payroll roster, rates, and bank details."
            />
            <NavCard
              href="/protected/dashboard/payroll/run"
              title="Run payroll"
              description="Process salaries for the selected month with adjustments."
            />
            <NavCard
              href="/protected/dashboard/payroll/payments"
              title="Payments"
              description="Review history, mark paid, cancel, and export CSV."
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-5">
      <p className="text-sm text-slate-400 mb-2">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="glass-card p-6 block hover:border-sky-500/40 transition-colors">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </Link>
  );
}
