'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plan, serverApi } from '@/lib/server';

export default function ServerPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await serverApi.getPlans();
      setPlans(data);
    } catch {
      showToast('Failed to load plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setDraft({ ...plan });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const savePlan = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const updated = await serverApi.updatePlan(editingId, {
        name: draft.name,
        monthly_price: draft.monthly_price,
        max_users: draft.max_users,
        max_projects: draft.max_projects,
        attendance_enabled: draft.attendance_enabled,
        calendar_enabled: draft.calendar_enabled,
        email_notifications_enabled: draft.email_notifications_enabled,
      });
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      cancelEdit();
      showToast('Plan updated', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      {toast && <div className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}>{toast.message}</div>}

      <div className="page-header">
        <p className="meta-text mb-1">
          <Link href="/server/dashboard" className="server-link">Overview</Link>
          <span className="mx-2">/</span>
          Plans
        </p>
        <h1 className="page-title text-3xl font-bold">Subscription plans</h1>
        <p className="page-subtitle mt-1">Platform-wide tiers assigned to organizations.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isEditing = editingId === plan.id;
            const data = isEditing ? draft : plan;

            return (
              <section key={plan.id} className="surface-panel server-plan-card">
                <div className="surface-panel-header">
                  <div>
                    <h2 className="surface-panel-title">{plan.name}</h2>
                    <p className="meta-text text-sm capitalize">{plan.tier} tier</p>
                  </div>
                  {!isEditing ? (
                    <button type="button" className="btn-secondary" onClick={() => startEdit(plan)}>
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                      <button type="button" className="btn-primary" onClick={savePlan} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="todo-form-field">
                    <label className="todo-form-label">Monthly price</label>
                    {isEditing ? (
                      <input
                        className="input-field"
                        value={data.monthly_price ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, monthly_price: e.target.value }))}
                      />
                    ) : (
                      <p className="stat-card-value text-xl">${plan.monthly_price}</p>
                    )}
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Max users</label>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input-field"
                        value={data.max_users ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, max_users: Number(e.target.value) }))}
                      />
                    ) : (
                      <p className="font-semibold">{plan.max_users}</p>
                    )}
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Max projects</label>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input-field"
                        value={data.max_projects ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, max_projects: Number(e.target.value) }))}
                      />
                    ) : (
                      <p className="font-semibold">{plan.max_projects}</p>
                    )}
                  </div>
                </div>

                <div className="server-plan-features mt-4">
                  {([
                    ['attendance_enabled', 'Attendance'],
                    ['calendar_enabled', 'Calendar'],
                    ['email_notifications_enabled', 'Email notifications'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="server-plan-feature">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={Boolean(data[key])}
                          onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.checked }))}
                        />
                      ) : (
                        <span className={`server-plan-feature-dot${plan[key] ? ' server-plan-feature-dot--on' : ''}`} />
                      )}
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
