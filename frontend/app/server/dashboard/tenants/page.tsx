'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DeleteTenantModal, DeleteTenantTarget } from '@/components/delete-tenant-modal';
import { CreateTenantInput, Plan, serverApi, TenantListItem } from '@/lib/server';

const EMPTY_FORM: CreateTenantInput = {
  name: '',
  slug: '',
  login_domain: '',
  admin_username: '',
  admin_password: '',
  admin_email: '',
  admin_first_name: '',
  admin_last_name: '',
  plan_id: undefined,
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ServerTenantsPage() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateTenantInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TenantListItem | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeleteTenantTarget | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [tenantData, planData] = await Promise.all([serverApi.getTenants(), serverApi.getPlans()]);
      setTenants(tenantData);
      setPlans(planData);
    } catch {
      showToast('Failed to load organizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter === 'active' && !tenant.is_active) return false;
      if (statusFilter === 'inactive' && tenant.is_active) return false;
      if (!query) return true;
      return (
        tenant.name.toLowerCase().includes(query) ||
        tenant.slug.toLowerCase().includes(query) ||
        tenant.login_domain.toLowerCase().includes(query)
      );
    });
  }, [tenants, search, statusFilter]);

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.is_active).length,
    users: tenants.reduce((sum, t) => sum + t.user_count, 0),
  }), [tenants]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload: CreateTenantInput = {
        ...form,
        slug: form.slug || slugify(form.name),
        login_domain: form.login_domain?.trim() || undefined,
      };
      const created = await serverApi.createTenant(payload);
      showToast(`Created ${created.name}`, 'success');
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await serverApi.deactivateTenant(deactivateTarget.id);
      showToast(`${deactivateTarget.name} deactivated`, 'success');
      setDeactivateTarget(null);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate organization';
      showToast(message, 'error');
    }
  };

  const openPurgeModal = (tenant: TenantListItem) => {
    setPurgeError(null);
    setPurgeTarget({ id: tenant.id, name: tenant.name, slug: tenant.slug });
  };

  const closePurgeModal = () => {
    setPurgeTarget(null);
    setPurgeError(null);
  };

  const confirmPurge = async (payload: { slug: string; password: string }) => {
    if (!purgeTarget) return;
    setPurging(true);
    setPurgeError(null);
    try {
      await serverApi.purgeTenant(purgeTarget.id, payload);
      showToast(`${purgeTarget.name} permanently deleted`, 'success');
      closePurgeModal();
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      setPurgeError(message);
      showToast(message, 'error');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="page-container">
      {toast && <div className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}>{toast.message}</div>}

      <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="meta-text mb-1">
            <Link href="/server/dashboard" className="server-link">Overview</Link>
            <span className="mx-2">/</span>
            Organizations
          </p>
          <h1 className="page-title text-3xl font-bold">Organizations</h1>
          <p className="page-subtitle mt-1">Provision and manage tenant workspaces on the platform.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
          New organization
        </button>
      </div>

      <div className="dashboard-kpi-grid mb-6">
        <div className="stat-card">
          <p className="stat-card-label">Total</p>
          <p className="stat-card-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Active</p>
          <p className="stat-card-value dashboard-stat-accent-green">{stats.active}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Users across tenants</p>
          <p className="stat-card-value dashboard-stat-accent-violet">{stats.users}</p>
        </div>
      </div>

      <div className="todo-toolbar mb-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or domain…"
            className="input-field w-full"
          />
        </div>
        <div className="server-filter-tabs">
          {(['all', 'active', 'inactive'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`server-filter-tab${statusFilter === value ? ' server-filter-tab--active' : ''}`}
              onClick={() => setStatusFilter(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-panel p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="empty-state py-12">
            <p>No organizations match your filters.</p>
          </div>
        ) : (
          <div className="server-table-wrap">
            <table className="server-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Sign-in domain</th>
                  <th>Plan</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <Link href={`/server/dashboard/tenants/${tenant.id}`} className="server-table-link">
                        {tenant.name}
                      </Link>
                      <span className="server-table-meta">{tenant.slug} · {tenant.schema_name}</span>
                    </td>
                    <td>
                      <span className="font-mono text-sm">*@{tenant.login_domain}</span>
                    </td>
                    <td>
                      {tenant.subscription ? (
                        <span className="badge badge-accent">{tenant.subscription.plan_name}</span>
                      ) : (
                        <span className="meta-text">—</span>
                      )}
                    </td>
                    <td>{tenant.user_count}</td>
                    <td>
                      <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {tenant.subscription?.is_effectively_expired && (
                        <span className="badge badge-warning ml-1">Expired</span>
                      )}
                    </td>
                    <td>
                      <div className="server-row-actions">
                        <Link href={`/server/dashboard/tenants/${tenant.id}`} className="icon-btn" title="Manage">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {tenant.is_active && (
                          <button
                            type="button"
                            className="icon-btn"
                            title="Deactivate"
                            onClick={() => setDeactivateTarget(tenant)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          title="Delete permanently"
                          onClick={() => openPurgeModal(tenant)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowCreateModal(false)}>
          <div className="modal-panel todo-form-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">New organization</h2>
                <p className="todo-form-subtitle">Creates a tenant schema and initial admin user.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowCreateModal(false)} aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="todo-form-field">
                    <label className="todo-form-label">Organization name *</label>
                    <input
                      className="input-field"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: prev.slug || slugify(e.target.value),
                        }))
                      }
                      placeholder="Technest Pvt. Ltd."
                    />
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Slug *</label>
                    <input
                      className="input-field font-mono text-sm"
                      required
                      value={form.slug}
                      onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                      placeholder="technest"
                    />
                  </div>
                </div>

                <div className="todo-form-field">
                  <label className="todo-form-label">Login domain postfix</label>
                  <div className="flex items-center gap-2">
                    <span className="meta-text shrink-0">user@</span>
                    <input
                      className="input-field flex-1"
                      value={form.login_domain}
                      onChange={(e) => setForm((prev) => ({ ...prev, login_domain: e.target.value }))}
                      placeholder="technest.com"
                    />
                  </div>
                </div>

                <div className="todo-form-field">
                  <label className="todo-form-label">Subscription plan</label>
                  <select
                    className="input-field"
                    value={form.plan_id ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        plan_id: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  >
                    <option value="">Default (Standard)</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.max_users} users, {plan.max_projects} projects
                      </option>
                    ))}
                  </select>
                </div>

                <div className="server-form-divider">Initial admin user</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="todo-form-field">
                    <label className="todo-form-label">Admin username *</label>
                    <input
                      className="input-field"
                      required
                      value={form.admin_username}
                      onChange={(e) => setForm((prev) => ({ ...prev, admin_username: e.target.value }))}
                      placeholder="admin"
                    />
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Admin password *</label>
                    <input
                      type="password"
                      className="input-field"
                      required
                      value={form.admin_password}
                      onChange={(e) => setForm((prev) => ({ ...prev, admin_password: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="todo-form-field">
                    <label className="todo-form-label">First name</label>
                    <input
                      className="input-field"
                      value={form.admin_first_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, admin_first_name: e.target.value }))}
                    />
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Last name</label>
                    <input
                      className="input-field"
                      value={form.admin_last_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, admin_last_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="todo-form-field">
                  <label className="todo-form-label">Admin email</label>
                  <input
                    type="email"
                    className="input-field"
                    value={form.admin_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, admin_email: e.target.value }))}
                    placeholder="admin@company.com"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deactivateTarget !== null}
        title="Deactivate organization"
        message={
          deactivateTarget
            ? `Deactivate "${deactivateTarget.name}"? Users will lose access until reactivated.`
            : ''
        }
        confirmText="Deactivate"
        cancelText="Cancel"
        isDestructive
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <DeleteTenantModal
        tenant={purgeTarget}
        isSubmitting={purging}
        errorMessage={purgeError}
        onClose={closePurgeModal}
        onConfirm={confirmPurge}
      />
    </div>
  );
}
