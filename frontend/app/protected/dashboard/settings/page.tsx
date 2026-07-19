'use client';

import { useEffect, useState } from 'react';
import { attendanceApi, OfficeSettings } from '@/lib/attendance';
import { integrationsApi, GitHubStatusResponse } from '@/lib/integrations';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const { terminology, refreshSettings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [githubStatus, setGithubStatus] = useState<GitHubStatusResponse | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [formData, setFormData] = useState({
    office_start_time: '10:00',
    office_end_time: '17:00',
    auto_mark_absent: true,
    weekend_holidays: 'saturday' as 'saturday' | 'sunday' | 'both',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Redirect non-admin users
    if (!isAdmin) {
      router.push('/protected/dashboard');
      return;
    }
    fetchSettings();
    fetchGitHubStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, router]);

  useEffect(() => {
    const githubParam = searchParams.get('github');
    if (!githubParam) return;
    if (githubParam === 'connected') {
      showToastMessage('GitHub connected successfully', 'success');
      fetchGitHubStatus();
    } else if (githubParam === 'error') {
      showToastMessage('GitHub connection failed. Please try again.', 'error');
    }
    router.replace('/protected/dashboard/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  const fetchGitHubStatus = async () => {
    try {
      setGithubLoading(true);
      const data = await integrationsApi.getGitHubStatus();
      setGithubStatus(data);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
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
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to start GitHub connection';
      showToastMessage(message, 'error');
      setGithubConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      setGithubConnecting(true);
      await integrationsApi.disconnectGitHub();
      setGithubStatus({ connected: false, configured: githubStatus?.configured ?? true });
      showToastMessage('GitHub disconnected', 'success');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to disconnect GitHub';
      showToastMessage(message, 'error');
    } finally {
      setGithubConnecting(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getOfficeSettings();
      setSettings(data);
      setFormData({
        office_start_time: data.office_start_time,
        office_end_time: data.office_end_time,
        auto_mark_absent: data.auto_mark_absent,
        weekend_holidays: data.weekend_holidays ?? 'saturday',
      });
    } catch (error) {
      showToastMessage('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await attendanceApi.updateOfficeSettings(formData);
      showToastMessage('Settings saved successfully!', 'success');
      fetchSettings();
      refreshSettings(); // Update global context
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to save settings';
      showToastMessage(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="page-container">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="breadcrumb">Dashboard</Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Settings</span>
        </div>
        <h1 className="page-title text-3xl font-bold">Settings</h1>
        <p className="page-subtitle mt-1">Configure office hours, attendance policies, and integrations</p>
      </div>

      <div className="mb-8 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">GitHub Integration</h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect your organization GitHub account to create issues from tickets and sync closed/reopened status.
            </p>
          </div>
          {githubStatus?.connected && (
            <span className="badge badge-success shrink-0">Connected</span>
          )}
        </div>

        {githubLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        ) : !githubStatus?.configured ? (
          <p className="text-sm text-amber-400">
            GitHub OAuth is not configured on the server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the backend environment.
          </p>
        ) : githubStatus.feature_enabled === false ? (
          <p className="text-sm text-amber-400">
            {githubStatus.feature_detail || 'Your subscription plan does not include GitHub integration. Ask your platform admin to enable it on your plan.'}
          </p>
        ) : githubStatus.connected && githubStatus.connection ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-slate-400 text-sm mb-1">Connected account</p>
              <p className="text-white font-medium">@{githubStatus.connection.github_login}</p>
              {githubStatus.connection.connected_by_name && (
                <p className="text-xs text-slate-500 mt-1">
                  Connected by {githubStatus.connection.connected_by_name}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnectGitHub}
              disabled={githubConnecting}
              className="btn-secondary px-4 py-2"
            >
              {githubConnecting ? 'Disconnecting...' : 'Disconnect GitHub'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Link tickets to GitHub issues (one-way creation). Closing or reopening a ticket updates the linked issue, and vice versa.
            </p>
            <button
              type="button"
              onClick={handleConnectGitHub}
              disabled={githubConnecting || githubStatus.feature_enabled === false}
              className="btn-primary px-4 py-2"
            >
              {githubConnecting ? 'Redirecting...' : 'Connect GitHub'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Office Hours</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Form */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Office Hours Configuration</h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Office Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.office_start_time}
                    onChange={(e) => setFormData({ ...formData, office_start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Developers can start marking attendance from this time
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Office End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.office_end_time}
                    onChange={(e) => setFormData({ ...formData, office_end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Attendance closes at this time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                <input
                  type="checkbox"
                  id="auto_mark_absent"
                  checked={formData.auto_mark_absent}
                  onChange={(e) => setFormData({ ...formData, auto_mark_absent: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="auto_mark_absent" className="text-slate-300 cursor-pointer text-sm">
                  Automatically mark absent after office hours end
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Weekly Off Days
                </label>
                <select
                  value={formData.weekend_holidays}
                  onChange={(e) => setFormData({ ...formData, weekend_holidays: e.target.value as 'saturday' | 'sunday' | 'both' })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="saturday">Saturday only (Default)</option>
                  <option value="sunday">Sunday only</option>
                  <option value="both">Saturday and Sunday</option>
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  Attendance is not required on selected weekly off days. Public holidays from the calendar are also excluded.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Current Status */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Current Status</h2>

            {settings && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Office Hours</p>
                  <p className="page-title text-2xl font-bold">
                    {formatTime(settings.office_start_time)} - {formatTime(settings.office_end_time)}
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Current Time Status</p>
                  <p className="text-lg">
                    {settings.is_within_office_hours ? (
                      <span className="text-green-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Within Office Hours
                      </span>
                    ) : settings.has_office_hours_ended ? (
                      <span className="text-red-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        Office Hours Ended
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                        Before Office Hours
                      </span>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Auto-Mark Absent</p>
                  <p className="text-lg text-white">
                    {settings.auto_mark_absent ? (
                      <span className="text-green-400">Enabled</span>
                    ) : (
                      <span className="text-slate-400">Disabled</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    When enabled, developers who haven&apos;t marked attendance by end of office hours will be automatically marked absent
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Weekly Off Days</p>
                  <p className="text-lg text-white capitalize">
                    {settings.weekend_holidays === 'both'
                      ? 'Saturday & Sunday'
                      : settings.weekend_holidays === 'sunday'
                        ? 'Sunday'
                        : 'Saturday'}
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">Last Updated</p>
                  <p className="text-white">
                    {new Date(settings.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h3 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How it works
              </h3>
              <ul className="text-sm text-slate-400 space-y-2 ml-6">
                <li>• {terminology.labelPlural} can only mark attendance during office hours</li>
                <li>• Attendance can be marked anytime between start and end time</li>
                <li>• Once office hours end, no one can mark attendance</li>
                <li>• If auto-mark absent is enabled, missing {terminology.labelPluralLower} are marked absent automatically</li>
                <li>• Exact marked time is recorded and visible to managers/admins</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
