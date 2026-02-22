'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { authApi, User } from '@/lib/auth';

export default function ProfilePage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
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
        username: currentUser.username || '',
      });
      setLoading(false);
    }
  }, [currentUser]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile(profileData);
      await refreshUser();
      showToastMessage('Profile updated successfully', 'success');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
        error.response?.data?.email?.[0] ||
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
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
        error.response?.data?.detail ||
        'Failed to change password';
      setPasswordErrors([errorMessage]);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-sky-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'manager': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
          Dashboard
        </Link>
        <span className="text-slate-500">/</span>
        <span className="text-white">Profile</span>
      </nav>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(currentUser.role)}`}>
              {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
            </span>
          </div>

          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-bold text-4xl">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{currentUser.username}</h2>
              <p className="text-slate-400">{currentUser.email}</p>
              {currentUser.department_roles && currentUser.department_roles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentUser.department_roles.map((role) => (
                    <span
                      key={role.id}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${role.color}20`,
                        color: role.color,
                        border: `1px solid ${role.color}40`
                      }}
                    >
                      {role.display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Edit Profile</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  className="input-field w-full bg-slate-700/50"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  disabled
                />
                <p className="text-xs text-slate-500 mt-1">Username cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="input-field w-full"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={profileData.first_name}
                  onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={profileData.last_name}
                  onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary px-6 py-2"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Password</h2>
              <p className="text-slate-400 text-sm">Change your account password</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Change Password
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-400">User ID</span>
              <span className="text-white">#{currentUser.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Account Status</span>
              <span className="text-green-400">Active</span>
            </div>
            {currentUser.created_at && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Member Since</span>
                <span className="text-white">{new Date(currentUser.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Change Password</h2>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      current_password: '',
                      new_password: '',
                      confirm_password: '',
                    });
                    setPasswordErrors([]);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {passwordErrors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  {passwordErrors.map((err, idx) => (
                    <p key={idx} className="text-red-400 text-sm">{err}</p>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      current_password: '',
                      new_password: '',
                      confirm_password: '',
                    });
                    setPasswordErrors([]);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-primary px-4 py-2"
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
