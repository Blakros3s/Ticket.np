'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PaymentStatus, PayrollEmployeeStatus } from '@/lib/payroll';

const PAYROLL_NAV = [
  { href: '/protected/dashboard/payroll', label: 'Overview', exact: true },
  { href: '/protected/dashboard/payroll/employees', label: 'Employees' },
  { href: '/protected/dashboard/payroll/run', label: 'Run payroll' },
  { href: '/protected/dashboard/payroll/payments', label: 'Payments' },
] as const;

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function usePayrollAdmin() {
  const { user, isLoading } = useAuth();
  return { isAdmin: user?.role === 'admin', isLoading };
}

export function PayrollAccessDenied() {
  return (
    <div className="page-container flex min-h-[60vh] items-center justify-center">
      <div className="surface-panel max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="page-title text-xl">Access denied</h1>
        <p className="page-subtitle mt-2">Payroll is available to administrators only.</p>
        <Link href="/protected/dashboard" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export function PayrollLoading({ label = 'Loading payroll…' }: { label?: string }) {
  return (
    <div className="page-container flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div
        className="h-12 w-12 animate-spin rounded-full border-b-2"
        style={{ borderColor: 'var(--accent)' }}
      />
      <p className="meta-text">{label}</p>
    </div>
  );
}

export function PayrollShell({
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-container">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/protected/dashboard/payroll">Payroll</Link>
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-2">
              <span className="breadcrumb-sep">/</span>
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <PayrollSubNav />
      {children}
    </div>
  );
}

export function PayrollSubNav() {
  const pathname = usePathname();

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {PAYROLL_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function PayrollStatCard({
  label,
  value,
  accent = 'dashboard-stat-accent-blue',
  href,
}: {
  label: string;
  value: string;
  accent?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="stat-card-label">{label}</p>
      <p className={`stat-card-value ${accent}`}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="stat-card stat-card--interactive">
        {content}
      </Link>
    );
  }

  return <div className="stat-card">{content}</div>;
}

export function PayrollPanel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-panel ${className}`}>
      {(title || actions) && (
        <div className="surface-panel-header">
          <div>
            {title && <h2 className="surface-panel-title">{title}</h2>}
            {description && <p className="page-subtitle mt-1">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PayrollToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 md:flex-row md:items-end">
      {children}
    </div>
  );
}

export function PayrollField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block flex-1 ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export function PayrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function PayrollTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-slate-700/40">
      <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
        {children}
      </tr>
    </thead>
  );
}

export function PayrollTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-700/40">{children}</tbody>;
}

export function PayrollEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a5 5 0 00-10 0v2M5 9h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="meta-text mt-2 max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EmployeeAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/30 to-violet-500/30 text-sm font-semibold text-white ring-1 ring-white/10">
      {initials || '?'}
    </div>
  );
}

export function EmployeeStatusBadge({ status }: { status: PayrollEmployeeStatus }) {
  const classes: Record<PayrollEmployeeStatus, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    inactive: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    terminated: 'bg-red-500/15 text-red-300 ring-red-500/30',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${classes[status]}`}>
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | null | string }) {
  const normalized = (status || 'pending').toLowerCase();
  const classes: Record<string, string> = {
    draft: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    paid: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    cancelled: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    pending: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${classes[normalized] || classes.pending}`}>
      {normalized}
    </span>
  );
}

export function PayrollModal({
  title,
  description,
  onClose,
  children,
  size = 'lg',
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const widthClass = size === 'xl' ? 'max-w-4xl' : size === 'md' ? 'max-w-lg' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={`surface-panel w-full ${widthClass} max-h-[90vh] overflow-y-auto`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description && <p className="page-subtitle mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PayrollToast({
  message,
  type,
}: {
  message: string;
  type: 'success' | 'error';
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl ring-1 ${
        type === 'success'
          ? 'bg-emerald-600 text-white ring-emerald-400/30'
          : 'bg-red-600 text-white ring-red-400/30'
      }`}
    >
      <span>{message}</span>
    </div>
  );
}

export function usePayrollToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}

export function PayrollActionButton({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50',
    success: 'rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function PayrollQuickLink({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group stat-card stat-card--interactive flex h-full flex-col gap-3"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
      <div>
        <h3 className="text-base font-semibold text-white group-hover:text-sky-300">{title}</h3>
        <p className="page-subtitle mt-1">{description}</p>
      </div>
    </Link>
  );
}

export function PeriodFields({
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <PayrollField label="Year" className="md:max-w-[140px]">
        <select className="input-field" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
          {Array.from({ length: 6 }, (_, index) => currentYear - 2 + index).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </PayrollField>
      <PayrollField label="Month" className="md:max-w-[180px]">
        <select className="input-field" value={month} onChange={(e) => onMonthChange(Number(e.target.value))}>
          {MONTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </PayrollField>
    </>
  );
}
