'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatCurrency,
  monthLabel,
  PaymentMethod,
  payrollApi,
  PeriodStatusRow,
} from '@/lib/payroll';
import {
  EmployeeAvatar,
  PaymentStatusBadge,
  PayrollAccessDenied,
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

interface EditableRow extends PeriodStatusRow {
  selected: boolean;
}

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function RunPayrollPage() {
  const { isAdmin, isLoading } = usePayrollAdmin();
  const { toast, showToast } = usePayrollToast();
  const initial = currentPeriod();

  const [periodYear, setPeriodYear] = useState(initial.year);
  const [periodMonth, setPeriodMonth] = useState(initial.month);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
  }, [periodYear, periodMonth, showToast]);

  useEffect(() => {
    if (isLoading || !isAdmin) return;
    loadPeriod();
  }, [isLoading, isAdmin, loadPeriod]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const payableRows = useMemo(() => rows.filter((row) => row.payment_status !== 'paid'), [rows]);
  const allSelected = payableRows.length > 0 && payableRows.every((row) => row.selected);
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

  const toggleSelectAll = () => {
    const nextSelected = !allSelected;
    setRows((current) =>
      current.map((row) =>
        row.payment_status === 'paid' ? row : { ...row, selected: nextSelected },
      ),
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

  if (isLoading) return <PayrollLoading />;
  if (!isAdmin) return <PayrollAccessDenied />;

  return (
    <PayrollShell
      title="Run payroll"
      subtitle={monthLabel(periodYear, periodMonth)}
      breadcrumb={[{ label: 'Run payroll' }]}
      actions={
        <>
          <button type="button" className="btn-secondary" disabled={submitting} onClick={() => submit(false)}>
            Save draft
          </button>
          <button type="button" className="btn-primary" disabled={submitting} onClick={() => submit(true)}>
            {submitting ? 'Processing…' : 'Pay selected'}
          </button>
        </>
      }
    >
      <PayrollToolbar>
        <PeriodFields
          year={periodYear}
          month={periodMonth}
          onYearChange={setPeriodYear}
          onMonthChange={setPeriodMonth}
        />
        <PayrollField label="Payment date">
          <input className="input-field" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </PayrollField>
        <PayrollField label="Payment method" className="md:max-w-[200px]">
          <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="qr">QR</option>
          </select>
        </PayrollField>
      </PayrollToolbar>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="stat-card-label">Selected employees</p>
          <p className="stat-card-value dashboard-stat-accent-blue">{selectedRows.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Total net payout</p>
          <p className="stat-card-value dashboard-stat-accent-green">{formatCurrency(selectedTotal.toFixed(2))}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Active roster</p>
          <p className="stat-card-value dashboard-stat-accent-violet">{rows.length}</p>
        </div>
      </div>

      <PayrollPanel
        title="Pay run grid"
        description="Adjust hours and line items per employee. Paid rows are locked."
      >
        {loading ? (
          <PayrollLoading label="Loading pay run…" />
        ) : rows.length === 0 ? (
          <PayrollEmptyState
            title="No active employees"
            description="Add active employees to the payroll roster before running this month's salaries."
          />
        ) : (
          <PayrollTable>
            <PayrollTableHead>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all payable employees"
                />
              </th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Allowances</th>
              <th className="px-4 py-3">Overtime</th>
              <th className="px-4 py-3">Bonus</th>
              <th className="px-4 py-3">Deductions</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
            </PayrollTableHead>
            <PayrollTableBody>
              {rows.map((row) => {
                const locked = row.payment_status === 'paid';
                return (
                  <tr key={row.employee.id} className={`transition-colors ${row.selected ? 'bg-sky-500/5' : ''} hover:bg-slate-700/20`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={locked}
                        onChange={(e) => updateRow(row.employee.id, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar name={row.employee.full_name} />
                        <div>
                          <p className="font-medium text-white">{row.employee.full_name}</p>
                          <p className="font-mono text-xs text-sky-300">{row.employee.employee_code}</p>
                          <p className="meta-text text-xs">{row.employee.pay_type_display}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.employee.pay_type === 'hourly' ? (
                        <input
                          className="input-field w-24"
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.units_worked ?? ''}
                          disabled={locked}
                          onChange={(e) => updateRow(row.employee.id, { units_worked: e.target.value })}
                        />
                      ) : (
                        <span className="meta-text">—</span>
                      )}
                    </td>
                    {(['allowances', 'overtime', 'bonus', 'deductions'] as const).map((field) => (
                      <td className="px-4 py-3" key={field}>
                        <input
                          className="input-field w-24"
                          type="number"
                          min="0"
                          step="0.01"
                          value={row[field]}
                          disabled={locked}
                          onChange={(e) => updateRow(row.employee.id, { [field]: e.target.value })}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 font-semibold text-white">{formatCurrency(row.net_amount)}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={row.payment_status} />
                    </td>
                  </tr>
                );
              })}
            </PayrollTableBody>
          </PayrollTable>
        )}
      </PayrollPanel>

      {toast && <PayrollToast message={toast.message} type={toast.type} />}
    </PayrollShell>
  );
}
