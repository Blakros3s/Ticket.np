'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DeleteTenantModal, DeleteTenantTarget } from '@/components/delete-tenant-modal';
import { Plan, serverApi, TenantDetail, TenantUser } from '@/lib/server';

export default function ServerTenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = Number(params.id);

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [planNotes, setPlanNotes] = useState('');
  const [assigningPlan, setAssigningPlan] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'employee' as TenantUser['role'],
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [resetUser, setResetUser] = useState<TenantUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const [purgeTarget, setPurgeTarget] = useState<DeleteTenantTarget | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTenant = useCallback(async () => {
    if (!tenantId || Number.isNaN(tenantId)) return;
    try {
      setLoading(true);
      setLoadError(null);

      const [tenantData, planData] = await Promise.all([
        serverApi.getTenant(tenantId),
        serverApi.getPlans(),
      ]);

      setTenant(tenantData);
      setPlans(planData);
      setEditName(tenantData.name);
      setEditDomain(tenantData.login_domain);
      setSelectedPlanId(tenantData.subscription?.plan_id ?? '');
      setPlanNotes(tenantData.subscription?.notes ?? '');

      try {
        const userData = await serverApi.getTenantUsers(tenantId);
        setUsers(userData);
      } catch {
        showToast('Failed to load tenant users', 'error');
        setUsers([]);
      }
    } catch {
      setTenant(null);
      setLoadError('Failed to load organization');
      showToast('Failed to load organization', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingProfile(true);
    try {
      const updated = await serverApi.updateTenant(tenant.id, {
        name: editName.trim(),
        login_domain: editDomain.trim(),
      });
      setTenant(updated);
      showToast('Organization updated', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !selectedPlanId) return;
    setAssigningPlan(true);
    try {
      const updated = await serverApi.assignPlan(tenant.id, {
        plan_id: Number(selectedPlanId),
        notes: planNotes,
      });
      setTenant(updated);
      showToast('Plan assigned', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign plan', 'error');
    } finally {
      setAssigningPlan(false);
    }
  };

  const handleReactivate = async () => {
    if (!tenant) return;
    try {
      const updated = await serverApi.reactivateTenant(tenant.id);
      setTenant(updated);
      showToast('Organization reactivated', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reactivation failed', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setCreatingUser(true);
    try {
      const created = await serverApi.createTenantUser(tenant.id, newUser);
      setUsers((prev) => [...prev, created]);
      setShowUserModal(false);
      setNewUser({ username: '', password: '', email: '', first_name: '', last_name: '', role: 'employee' });
      showToast('User created', 'success');
      await loadTenant();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !resetUser || !resetPassword) return;

    setResettingPassword(true);
    try {
      await serverApi.resetTenantUserPassword(tenant.id, resetUser.id, resetPassword);
      showToast(`Password reset for ${resetUser.username}`, 'success');
      setResetUser(null);
      setResetPassword('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to reset password', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  const openPurgeModal = () => {
    if (!tenant) return;
    setPurgeError(null);
    setPurgeTarget({ id: tenant.id, name: tenant.name, slug: tenant.slug });
  };

  const closePurgeModal = () => {
    setPurgeTarget(null);
    setPurgeError(null);
  };

  const handlePurge = async (payload: { slug: string; password: string }) => {
    if (!tenant) return;
    setPurging(true);
    setPurgeError(null);
    try {
      await serverApi.purgeTenant(tenant.id, payload);
      showToast(`${tenant.name} permanently deleted`, 'success');
      closePurgeModal();
      router.push('/server/dashboard/tenants');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete organization';
      setPurgeError(message);
      showToast(message, 'error');
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p>{loadError || 'Organization not found.'}</p>
          <Link href="/server/dashboard/tenants" className="btn-primary mt-4 inline-flex">
            Back to organizations
          </Link>
        </div>
      </div>
    );
  }

  const formatLoginAddress = (username: string) =>
    tenant.login_domain ? `${username}@${tenant.login_domain}` : username;

  const usage = tenant.subscription?.usage ?? {};
  const limits = tenant.subscription?.limits;

  return (
    <div className="page-container">
      {toast && <div className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}>{toast.message}</div>}

      <div className="page-header">
        <p className="meta-text mb-1">
          <Link href="/server/dashboard/tenants" className="server-link">Organizations</Link>
          <span className="mx-2">/</span>
          {tenant.name}
        </p>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold">{tenant.name}</h1>
            <p className="page-subtitle mt-1 font-mono text-sm">
              {tenant.slug} · schema {tenant.schema_name} · *@{tenant.login_domain}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-neutral'}`}>
              {tenant.is_active ? 'Active' : 'Inactive'}
            </span>
            {tenant.subscription && (
              <span className="badge badge-accent">{tenant.subscription.plan_name}</span>
            )}
            {!tenant.is_active && (
              <button type="button" className="btn-secondary" onClick={handleReactivate}>
                Reactivate
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
              onClick={openPurgeModal}
            >
              Delete permanently
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="surface-panel xl:col-span-2">
          <div className="surface-panel-header">
            <h2 className="surface-panel-title">Organization settings</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="todo-form-field">
              <label className="todo-form-label">Display name</label>
              <input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="todo-form-field">
              <label className="todo-form-label">Login domain</label>
              <div className="flex items-center gap-2">
                <span className="meta-text shrink-0">user@</span>
                <input className="input-field flex-1 font-mono text-sm" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="surface-panel">
          <div className="surface-panel-header">
            <h2 className="surface-panel-title">Subscription</h2>
          </div>
          {tenant.subscription ? (
            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between gap-3">
                <span className="meta-text">Plan</span>
                <span>{tenant.subscription.plan_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="meta-text">Status</span>
                <span className="capitalize">{tenant.subscription.status}</span>
              </div>
              {limits && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="meta-text">Users</span>
                    <span>{usage.users ?? 0} / {limits.max_users}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="meta-text">Projects</span>
                    <span>{usage.projects ?? 0} / {limits.max_projects}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="meta-text text-sm mb-4">No subscription assigned.</p>
          )}

          <form onSubmit={handleAssignPlan} className="space-y-3">
            <select
              className="input-field"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="" disabled>Select plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder="Internal notes (optional)"
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
            />
            <button type="submit" className="btn-primary w-full" disabled={assigningPlan}>
              {assigningPlan ? 'Assigning…' : 'Assign plan'}
            </button>
          </form>
        </section>
      </div>

      <section className="surface-panel mt-6 p-0 overflow-hidden">
        <div className="surface-panel-header px-5 pt-5">
          <h2 className="surface-panel-title">Tenant users</h2>
          <button type="button" className="btn-primary" onClick={() => setShowUserModal(true)}>
            Add user
          </button>
        </div>

        {users.length === 0 ? (
          <div className="empty-state py-10">No users in this organization.</div>
        ) : (
          <div className="server-table-wrap">
            <table className="server-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Sign-in address</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="font-medium">{user.username}</span>
                      {(user.first_name || user.last_name) && (
                        <span className="server-table-meta block">{user.first_name} {user.last_name}</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-sm">{formatLoginAddress(user.username)}</span>
                    </td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-neutral'} capitalize`}>
                        {user.role === 'employee' ? 'Developer' : user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="server-row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Reset password"
                          onClick={() => {
                            setResetUser(user);
                            setResetPassword('');
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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
      </section>

      <section className="surface-panel mt-6 server-danger-zone">
        <h2 className="surface-panel-title dashboard-stat-accent-red">Danger zone</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Permanently delete this organization, drop its PostgreSQL schema, and remove all tenant data.
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
          onClick={openPurgeModal}
        >
          Delete organization permanently
        </button>
      </section>

      {showUserModal && (
        <div className="modal-overlay" onClick={() => !creatingUser && setShowUserModal(false)}>
          <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add tenant user</h2>
              <button type="button" className="icon-btn" onClick={() => setShowUserModal(false)} aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="todo-form-field">
                    <label className="todo-form-label">Username *</label>
                    <input className="input-field" required value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} />
                  </div>
                  <div className="todo-form-field">
                    <label className="todo-form-label">Password *</label>
                    <input type="password" className="input-field" required value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                  </div>
                </div>
                <div className="todo-form-field">
                  <label className="todo-form-label">Role</label>
                  <select className="input-field" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as TenantUser['role'] }))}>
                    <option value="employee">Developer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="todo-form-field">
                  <label className="todo-form-label">Email</label>
                  <input type="email" className="input-field" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowUserModal(false)} disabled={creatingUser}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={creatingUser}>{creatingUser ? 'Creating…' : 'Create user'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="modal-overlay" onClick={() => !resettingPassword && setResetUser(null)}>
          <div className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Reset password</h2>
                <p className="todo-form-subtitle">
                  {resetUser.role === 'admin' ? 'Tenant admin' : 'User'}: {formatLoginAddress(resetUser.username)}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setResetUser(null)} aria-label="Close" disabled={resettingPassword}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body space-y-4">
                <div className="todo-form-field">
                  <label className="todo-form-label">New password</label>
                  <input
                    type="password"
                    className="input-field"
                    required
                    minLength={8}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    disabled={resettingPassword}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary flex-1" onClick={() => setResetUser(null)} disabled={resettingPassword}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={resettingPassword || resetPassword.length < 8}>
                  {resettingPassword ? 'Resetting…' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteTenantModal
        tenant={purgeTarget}
        isSubmitting={purging}
        errorMessage={purgeError}
        onClose={closePurgeModal}
        onConfirm={handlePurge}
      />
    </div>
  );
}
