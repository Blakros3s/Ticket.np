'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-context';
import { serverApi, TenantListItem } from '@/lib/server';

export default function ServerDashboardPage() {
  const { user } = usePlatformAuth();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    serverApi
      .getTenants()
      .then(setTenants)
      .catch(() => setError('Failed to load platform overview'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.is_active).length;
    const inactive = tenants.length - active;
    const totalUsers = tenants.reduce((sum, t) => sum + (t.user_count || 0), 0);
    const expiring = tenants.filter((t) => t.subscription?.is_effectively_expired).length;
    return { total: tenants.length, active, inactive, totalUsers, expiring };
  }, [tenants]);

  const recentTenants = useMemo(
    () => [...tenants].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [tenants]
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title text-3xl font-bold mb-2">
          Welcome, <span style={{ color: 'var(--accent)' }}>{user?.username}</span>
        </h1>
        <p className="page-subtitle">
          Manage organizations, subscriptions, and platform-wide settings.
        </p>
      </div>

      {error && (
        <div className="server-alert server-alert--error mb-6">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          <div className="dashboard-kpi-grid">
            <Link href="/server/dashboard/tenants" className="stat-card stat-card--interactive">
              <p className="stat-card-label">Organizations</p>
              <p className="stat-card-value dashboard-stat-accent-blue">{stats.total}</p>
            </Link>
            <div className="stat-card">
              <p className="stat-card-label">Active tenants</p>
              <p className="stat-card-value dashboard-stat-accent-green">{stats.active}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Total tenant users</p>
              <p className="stat-card-value dashboard-stat-accent-violet">{stats.totalUsers}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Subscription issues</p>
              <p className="stat-card-value dashboard-stat-accent-amber">{stats.expiring}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <section className="surface-panel xl:col-span-2">
              <div className="surface-panel-header">
                <h2 className="surface-panel-title">Recent organizations</h2>
                <Link href="/server/dashboard/tenants" className="dashboard-link text-sm">
                  View all →
                </Link>
              </div>

              {recentTenants.length === 0 ? (
                <div className="empty-state py-8">
                  <p>No organizations yet.</p>
                  <Link href="/server/dashboard/tenants" className="btn-primary mt-4 inline-flex">
                    Create organization
                  </Link>
                </div>
              ) : (
                <div className="server-table-wrap">
                  <table className="server-table">
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Sign-in domain</th>
                        <th>Users</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td>
                            <Link href={`/server/dashboard/tenants/${tenant.id}`} className="server-table-link">
                              {tenant.name}
                            </Link>
                            <span className="server-table-meta">{tenant.slug}</span>
                          </td>
                          <td className="font-mono text-sm">{tenant.login_domain}</td>
                          <td>{tenant.user_count}</td>
                          <td>
                            <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-neutral'}`}>
                              {tenant.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="surface-panel">
              <div className="surface-panel-header">
                <h2 className="surface-panel-title">Quick actions</h2>
              </div>
              <div className="server-quick-actions">
                <Link href="/server/dashboard/tenants" className="server-quick-action">
                  <span className="server-quick-action-title">Provision tenant</span>
                  <span className="server-quick-action-desc">Create a new organization with an admin user</span>
                </Link>
                <Link href="/server/dashboard/plans" className="server-quick-action">
                  <span className="server-quick-action-title">Manage plans</span>
                  <span className="server-quick-action-desc">Review subscription tiers and limits</span>
                </Link>
              </div>

              <div className="server-info-box mt-5">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Platform access
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  You are signed in as a server administrator. Tenant users sign in separately at the organization login page.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
