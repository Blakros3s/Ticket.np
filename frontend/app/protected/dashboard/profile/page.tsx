'use client';

import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { integrationsApi, GitHubStatusResponse } from '@/lib/integrations';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authApi } from '@/lib/auth';

function formatRole(role: string, developerLabel: string) {
  if (role === 'employee') return developerLabel;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case 'admin':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'manager':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default:
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  }
}

export default function ProfilePage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { terminology } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [githubStatus, setGithubStatus] = useState<GitHubStatusResponse | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubConnecting, setGithubConnecting] = useState(false);

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (currentUser) {
      setProfileData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
      });
      setLoading(false);
      fetchGitHubStatus();
    }
  }, [currentUser]);

  useEffect(() => {
    const githubParam = searchParams.get('github');
    if (!githubParam) return;
    if (githubParam === 'connected') {
      showToastMessage('GitHub connected successfully', 'success');
      fetchGitHubStatus();
    } else if (githubParam === 'error') {
      showToastMessage('GitHub connection failed. Please try again.', 'error');
    }
    router.replace('/protected/dashboard/profile');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  const fetchGitHubStatus = async () => {
    try {
      setGithubLoading(true);
      const data = await integrationsApi.getGitHubStatus();
      setGithubStatus(data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const detail = err.response?.data?.detail;
      setGithubStatus({
        connected: false,
        configured: true,
        feature_enabled: false,
        feature_detail: typeof detail === 'string' ? detail : 'Failed to load GitHub integration status.',
      });
    } finally {
      setGithubLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setGithubConnecting(true);
      const authorizeUrl = await integrationsApi.connectGitHub();
      window.location.href = authorizeUrl;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      showToastMessage(err.response?.data?.detail || 'Failed to start GitHub connection', 'error');
      setGithubConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      setGithubConnecting(true);
      await integrationsApi.disconnectGitHub();
      setGithubStatus({ connected: false, configured: githubStatus?.configured ?? true });
      showToastMessage('GitHub disconnected', 'success');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      showToastMessage(err.response?.data?.detail || 'Failed to disconnect GitHub', 'error');
    } finally {
      setGithubConnecting(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({
        email: profileData.email,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
      });
      await refreshUser();
      showToastMessage('Profile updated successfully', 'success');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; email?: string[] } } };
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.email?.[0] ||
        'Failed to update profile';
      showToastMessage(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors([]);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordErrors(['New passwords do not match']);
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordErrors(['Password must be at least 8 characters']);
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(passwordData);
      showToastMessage('Password changed successfully', 'success');
      setShowPasswordModal(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; detail?: string } } };
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to change password';
      setPasswordErrors([errorMessage]);
    } finally {
      setSaving(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    setPasswordErrors([]);
  };

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-sky-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const displayName =
    `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim() || currentUser.username;
  const roleLabel = formatRole(currentUser.role, terminology.label);
  const signInAddress = currentUser.login_address || currentUser.username;

  return (
    <div className="page-container max-w-4xl py-6 sm:py-8">
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}
        >
          {toast.message}
        </div>
      )}

      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/protected/dashboard" className="breadcrumb">
          Dashboard
        </Link>
        <span className="text-slate-500">/</span>
        <span className="text-white">Profile</span>
      </nav>

      <div className="profile-hero mb-6">
        <div className="profile-hero-avatar" aria-hidden="true">
          {(currentUser.first_name?.[0] || currentUser.username[0] || '?').toUpperCase()}
          {currentUser.last_name?.[0]?.toUpperCase() ?? ''}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="page-title text-2xl font-bold truncate">{displayName}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClass(currentUser.role)}`}
            >
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-slate-400 truncate">{currentUser.email}</p>
          {currentUser.department_roles && currentUser.department_roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {currentUser.department_roles.map((role) => (
                <span
                  key={role.id}
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${role.color}18`,
                    color: role.color,
                    border: `1px solid ${role.color}40`,
                  }}
                >
                  {role.display_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="profile-section">
          <div className="profile-section-header">
            <div>
              <h2 className="profile-section-title">Personal information</h2>
              <p className="profile-section-desc">You can update these fields yourself.</p>
            </div>
            <span className="profile-section-badge profile-section-badge--editable">Editable</span>
          </div>
          <div className="profile-section-body">
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="profile-field-grid">
                <div className="profile-field">
                  <label htmlFor="profile-first-name">First name</label>
                  <input
                    id="profile-first-name"
                    type="text"
                    className="input-field w-full"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="profile-field">
                  <label htmlFor="profile-last-name">Last name</label>
                  <input
                    id="profile-last-name"
                    type="text"
                    className="input-field w-full"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
                <div className="profile-field sm:col-span-2">
                  <label htmlFor="profile-email">Email</label>
                  <input
                    id="profile-email"
                    type="email"
                    required
                    className="input-field w-full"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    autoComplete="email"
                  />
                  <p className="profile-field-hint">Used for notifications and account recovery.</p>
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-header">
            <div>
              <h2 className="profile-section-title">Account details</h2>
              <p className="profile-section-desc">Managed by your organization. Contact an admin to change these.</p>
            </div>
            <span className="profile-section-badge profile-section-badge--locked">Read-only</span>
          </div>
          <div className="profile-section-body">
            <div className="profile-field profile-field--readonly mb-4">
              <label>Username</label>
              <div className="profile-readonly-value font-mono text-sm">
                <svg className="w-4 h-4 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{signInAddress}</span>
              </div>
              <p className="profile-field-hint">
                Use this username to sign in. Ask an administrator to change it.
              </p>
            </div>

            <div className="profile-detail-row">
              <span className="profile-detail-label">Role</span>
              <span className="profile-detail-value">{roleLabel}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">Account status</span>
              <span className={`profile-detail-value ${currentUser.is_active ? 'text-green-400' : 'text-red-400'}`}>
                {currentUser.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-detail-label">User ID</span>
              <span className="profile-detail-value">#{currentUser.id}</span>
            </div>
            {currentUser.created_at && (
              <div className="profile-detail-row">
                <span className="profile-detail-label">Member since</span>
                <span className="profile-detail-value">
                  {new Date(currentUser.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {currentUser.department_roles && currentUser.department_roles.length > 0 && (
              <div className="profile-detail-row">
                <span className="profile-detail-label">Department</span>
                <span className="profile-detail-value">
                  {currentUser.department_roles.map((r) => r.display_name).join(', ')}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="profile-section mb-6">
        <div className="profile-section-header">
          <div>
            <h2 className="profile-section-title">GitHub</h2>
            <p className="profile-section-desc">
              Connect your personal GitHub account so issues you create or close in TicketHub appear under your name on GitHub.
            </p>
          </div>
          {githubStatus?.connected && (
            <span className="profile-section-badge profile-section-badge--editable">Connected</span>
          )}
        </div>
        <div className="profile-section-body">
          {githubLoading ? (
            <div className="h-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
            </div>
          ) : !githubStatus?.configured ? (
            <p className="text-sm text-amber-400">
              GitHub OAuth is not configured on the server. Ask your platform administrator.
            </p>
          ) : githubStatus.feature_enabled === false ? (
            <p className="text-sm text-amber-400">
              {githubStatus.feature_detail || 'Your subscription plan does not include GitHub integration.'}
            </p>
          ) : githubStatus.connected && githubStatus.connection ? (
            <div className="space-y-4">
              <div className="profile-readonly-value font-mono text-sm">
                @{githubStatus.connection.github_login}
              </div>
              <button
                type="button"
                onClick={handleDisconnectGitHub}
                disabled={githubConnecting}
                className="btn-secondary px-4 py-2"
              >
                {githubConnecting ? 'Disconnecting…' : 'Disconnect GitHub'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Required to create GitHub issues from tickets and to sync close/reopen actions under your GitHub identity.
              </p>
              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={githubConnecting}
                className="btn-primary px-4 py-2"
              >
                {githubConnecting ? 'Redirecting…' : 'Connect GitHub'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-header">
          <div>
            <h2 className="profile-section-title">Security</h2>
            <p className="profile-section-desc">Keep your account secure with a strong password.</p>
          </div>
          <span className="profile-section-badge profile-section-badge--editable">Editable</span>
        </div>
        <div className="profile-section-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Password</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Last changed date is not tracked. Update if you suspect unauthorized access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="btn-primary px-5 py-2 whitespace-nowrap self-start sm:self-auto"
            >
              Change password
            </button>
          </div>
        </div>
      </section>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="dashboard-section-title">Change password</h2>
              <button type="button" onClick={closePasswordModal} className="icon-btn" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {passwordErrors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  {passwordErrors.map((err) => (
                    <p key={err} className="text-red-400 text-sm">{err}</p>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Current password
                </label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  New password
                </label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  autoComplete="new-password"
                />
                <p className="profile-field-hint">Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary px-4 py-2">
                  {saving ? 'Changing…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
