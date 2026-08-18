'use client';

import { useEffect, useState } from 'react';
import { attendanceApi, OfficeSettings } from '@/lib/attendance';
import { integrationsApi, GitHubStatusResponse } from '@/lib/integrations';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const { refreshSettings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [githubFeature, setGithubFeature] = useState<Pick<GitHubStatusResponse, 'configured' | 'feature_enabled' | 'feature_detail'> | null>(null);
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
    if (!isAdmin) {
      router.push('/protected/dashboard');
      return;
    }
    fetchSettings();
    fetchGitHubFeatureStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, router]);

  const fetchGitHubFeatureStatus = async () => {
    try {
      const data = await integrationsApi.getGitHubStatus();
      setGithubFeature({
        configured: data.configured,
        feature_enabled: data.feature_enabled,
        feature_detail: data.feature_detail,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const detail = err.response?.data?.detail;
      setGithubFeature({
        configured: true,
        feature_enabled: false,
        feature_detail: typeof detail === 'string' ? detail : 'Failed to load GitHub integration status.',
      });
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
      refreshSettings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      showToastMessage(err.response?.data?.detail || 'Failed to save settings', 'error');
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
    return null;
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
              Each team member connects their own GitHub account in Profile. Actions on linked issues (create, close, reopen) appear under that person on GitHub.
            </p>
          </div>
          {githubFeature?.feature_enabled && (
            <span className="badge badge-success shrink-0">Enabled</span>
          )}
        </div>

        {!githubFeature?.configured ? (
          <p className="text-sm text-amber-400">
            GitHub OAuth is not configured on the server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the backend environment.
          </p>
        ) : githubFeature.feature_enabled === false ? (
          <p className="text-sm text-amber-400">
            {githubFeature.feature_detail || 'Your subscription plan does not include GitHub integration. Ask your platform admin to enable it on your plan.'}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            GitHub integration is enabled for this organization.{' '}
            <Link href="/protected/dashboard/profile" className="text-sky-400 hover:text-sky-300">
              Connect your GitHub account in Profile
            </Link>
            {' '}to create issues from tickets and sync status changes.
          </p>
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
                    value={formData.office_start_time}
                    onChange={(e) => setFormData({ ...formData, office_start_time: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Office End Time
                  </label>
                  <input
                    type="time"
                    value={formData.office_end_time}
                    onChange={(e) => setFormData({ ...formData, office_end_time: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Weekend Holidays
                </label>
                <select
                  value={formData.weekend_holidays}
                  onChange={(e) => setFormData({ ...formData, weekend_holidays: e.target.value as 'saturday' | 'sunday' | 'both' })}
                  className="input-field w-full"
                >
                  <option value="saturday">Saturday only</option>
                  <option value="sunday">Sunday only</option>
                  <option value="both">Saturday and Sunday</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto_mark_absent"
                  checked={formData.auto_mark_absent}
                  onChange={(e) => setFormData({ ...formData, auto_mark_absent: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="auto_mark_absent" className="text-sm text-slate-300">
                  Automatically mark absent if no check-in by office start time
                </label>
              </div>

              <button type="submit" disabled={saving} className="btn-primary px-6 py-2">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Current Settings Summary */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Current Configuration</h2>
            {settings && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                  <span className="text-slate-400">Office Hours</span>
                  <span className="text-white font-medium">
                    {formatTime(settings.office_start_time)} - {formatTime(settings.office_end_time)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                  <span className="text-slate-400">Weekend Holidays</span>
                  <span className="text-white font-medium capitalize">
                    {settings.weekend_holidays === 'both' ? 'Saturday & Sunday' : settings.weekend_holidays}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-slate-400">Auto Mark Absent</span>
                  <span className={`font-medium ${settings.auto_mark_absent ? 'text-green-400' : 'text-red-400'}`}>
                    {settings.auto_mark_absent ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
