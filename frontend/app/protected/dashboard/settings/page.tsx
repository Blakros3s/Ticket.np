'use client';

import { useEffect, useState } from 'react';
import { attendanceApi, OfficeSettings } from '@/lib/attendance';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [formData, setFormData] = useState({
    office_start_time: '10:00',
    office_end_time: '17:00',
    auto_mark_absent: true
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getOfficeSettings();
      setSettings(data);
      setFormData({
        office_start_time: data.office_start_time,
        office_end_time: data.office_end_time,
        auto_mark_absent: data.auto_mark_absent
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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white">Dashboard</Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Settings</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Office Settings</h1>
        <p className="text-slate-400 mt-1">Configure office hours and attendance policies</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
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
                    Employees can start marking attendance from this time
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
                <label htmlFor="auto_mark_absent" className="text-slate-300 cursor-pointer">
                  Automatically mark absent after office hours end
                </label>
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
                  <p className="text-2xl font-bold text-white">
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
                    When enabled, employees who haven&apos;t marked attendance by end of office hours will be automatically marked absent
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
                <li>• Employees can only mark attendance during office hours</li>
                <li>• Attendance can be marked anytime between start and end time</li>
                <li>• Once office hours end, no one can mark attendance</li>
                <li>• If auto-mark absent is enabled, missing employees are marked absent automatically</li>
                <li>• Exact marked time is recorded and visible to managers/admins</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
