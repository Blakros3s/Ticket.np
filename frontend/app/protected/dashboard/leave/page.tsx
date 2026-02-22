'use client';

import { useCallback, useEffect, useState } from 'react';
import { attendanceApi, LeaveRequest } from '@/lib/attendance';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function LeavePage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    start_date: '',
    end_date: '',
    message: ''
  });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Edit & Delete state
  const [isEditing, setIsEditing] = useState(false);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Admin/Manager sees all leave requests, regular users see their own
      const requests = isAdminOrManager
        ? await attendanceApi.getLeaveRequests()
        : await attendanceApi.getMyLeaveRequests();
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load leave data:', error);
      if (!silent) showToastMessage('Failed to load leave data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
    // Refresh every 60 seconds (silent)
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData, authLoading, user]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editTargetId) {
        await attendanceApi.updateLeaveRequest(editTargetId, {
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          message: leaveForm.message
        });
        showToastMessage('Leave request updated!', 'success');
      } else {
        await attendanceApi.createLeaveRequest({
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          message: leaveForm.message
        });
        showToastMessage('Leave request submitted!', 'success');
      }
      setShowLeaveModal(false);
      setLeaveForm({ start_date: '', end_date: '', message: '' });
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to submit leave request';
      showToastMessage(message, 'error');
    }
  };

  const handleApproveLeave = async (id: number) => {
    try {
      await attendanceApi.approveLeaveRequest(id);
      showToastMessage('Leave request approved!', 'success');
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to approve';
      showToastMessage(message, 'error');
    }
  };

  const handleRejectClick = (request: LeaveRequest) => {
    setRejectTarget(request);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    try {
      await attendanceApi.rejectLeaveRequest(rejectTarget.id, rejectReason);
      showToastMessage('Leave request rejected!', 'success');
      setShowRejectModal(false);
      setRejectTarget(null);
      setRejectReason('');
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to reject';
      showToastMessage(message, 'error');
    }
  };

  const openEditModal = (request: LeaveRequest) => {
    setEditTargetId(request.id);
    setLeaveForm({
      start_date: request.start_date,
      end_date: request.end_date,
      message: request.message
    });
    setIsEditing(true);
    setShowLeaveModal(true);
  };

  const openDeleteModal = (id: number) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteLeave = async () => {
    if (!deleteTargetId) return;
    try {
      await attendanceApi.deleteLeaveRequest(deleteTargetId);
      showToastMessage('Leave request deleted!', 'success');
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to delete';
      showToastMessage(message, 'error');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'pending': return 'bg-amber-500/20 text-amber-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'cancelled': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  // Count stats
  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const myPendingCount = leaveRequests.filter(r => r.status === 'pending' && r.employee.id === user?.id).length;

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
          <span className="text-white">Leave Management</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Leave Management</h1>
        <p className="text-slate-400 mt-1">
          {isAdminOrManager
            ? 'Review and approve leave requests from your team'
            : 'Apply for leave and track your leave requests'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {isAdminOrManager ? (
              <>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">Approved This Month</p>
                  <p className="text-3xl font-bold text-green-400">{approvedCount}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">Total Requests</p>
                  <p className="text-3xl font-bold text-white">{leaveRequests.length}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">My Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-400">{myPendingCount}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">Approved Requests</p>
                  <p className="text-3xl font-bold text-green-400">
                    {leaveRequests.filter(r => r.status === 'approved' && r.employee.id === user?.id).length}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <p className="text-slate-400 text-sm">Total Requests</p>
                  <p className="text-3xl font-bold text-white">{leaveRequests.length}</p>
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditTargetId(null);
                setLeaveForm({ start_date: '', end_date: '', message: '' });
                setShowLeaveModal(true);
              }}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Apply for Leave
            </button>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              {isAdminOrManager ? 'All Leave Requests' : 'My Leave Requests'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    {isAdminOrManager && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Employee</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Applied On</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={isAdminOrManager ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                        No leave requests found
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-700/30">
                        {isAdminOrManager && (
                          <td className="px-4 py-3 text-white">
                            {request.employee.first_name} {request.employee.last_name}
                            <span className="text-slate-500 text-sm block">@{request.employee.username}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-300">
                          <div className="text-sm">{request.start_date}</div>
                          <div className="text-slate-500 text-xs">to {request.end_date}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{request.duration_days}</td>
                        <td className="px-4 py-3 text-slate-300 max-w-xs">
                          <p className="truncate" title={request.message}>
                            {request.message}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-sm">
                          {new Date(request.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {/* Admin/Manager can approve/reject pending requests */}
                            {request.status === 'pending' && isAdminOrManager && request.employee.id !== user?.id && (
                              <>
                                <button
                                  onClick={() => handleApproveLeave(request.id)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectClick(request)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {/* Users can edit/delete their own pending requests */}
                            {request.status === 'pending' && request.employee.id === user?.id && (
                              <div className="flex gap-2 ml-auto">
                                <button
                                  onClick={() => openEditModal(request)}
                                  className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(request.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            {/* Show approved by info for approved/rejected */}
                            {(request.status === 'approved' || request.status === 'rejected') && request.approved_by && (
                              <span className="text-xs text-slate-400">
                                by {request.approved_by.first_name} {request.approved_by.last_name}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Apply for Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  {isEditing ? 'Edit Leave Request' : 'Apply for Leave'}
                </h2>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    min={leaveForm.start_date || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  value={leaveForm.message}
                  onChange={(e) => setLeaveForm({ ...leaveForm, message: e.target.value })}
                  placeholder="Please provide details about your leave request..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                >
                  {isEditing ? 'Update Request' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Reject Leave Request</h2>
              <p className="text-slate-400 mb-4">
                Are you sure you want to reject the leave request from{' '}
                <span className="text-white font-medium">
                  {rejectTarget.employee.first_name} {rejectTarget.employee.last_name}
                </span>
                {' '}({rejectTarget.start_date} to {rejectTarget.end_date})?
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">Reason for Rejection (Optional)</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectTarget(null);
                    setRejectReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Confirm Deletion</h2>
            <p className="text-slate-400 mb-6 text-sm">
              Are you sure you want to delete this leave request? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTargetId(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteLeave}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
