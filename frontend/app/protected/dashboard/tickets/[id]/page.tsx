'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ticketsApi, Ticket, TicketStatus, TicketType, TicketPriority } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';
import { timelogsApi, WorkLog, TotalTime } from '@/lib/timelogs';
import { commentsApi, Comment } from '@/lib/comments';
import { activityApi, ActivityLog } from '@/lib/activity';

const statusColors: Record<TicketStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  qa: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  closed: 'bg-green-500/20 text-green-400 border-green-500/50',
  reopened: 'bg-red-500/20 text-red-400 border-red-500/50',
};

// Fixed linear workflow: new → in_progress → qa → closed → reopened
const statusFlow: Record<TicketStatus, TicketStatus[]> = {
  new: ['in_progress'],
  in_progress: ['qa'],
  qa: ['closed'],
  closed: ['reopened'],
  reopened: ['new', 'in_progress'],
};

// Helper function to format elapsed time
const formatElapsedTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = 0;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Helper function to format time with seconds for active timer
const formatActiveTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
};

export default function TicketDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const ticketId = Number(params.id);
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    type: 'task' as TicketType,
    priority: 'medium' as TicketPriority,
  });
  
  // Time tracking state
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [totalTime, setTotalTime] = useState<TotalTime | null>(null);
  const [activeSession, setActiveSession] = useState<{ active: boolean; workLog?: WorkLog; elapsedMinutes?: number } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [activeWorkLogUserId, setActiveWorkLogUserId] = useState<number | null>(null);

  // Comments and Activity state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const currentUserId = user?.id;

  // Check if current user can change workflow
  const canChangeWorkflow = () => {
    if (!ticket || !user) return false;
    // Manager/Admin can always change
    if (isManager) return true;
    // If ticket is unassigned, no one (except manager) can change workflow
    if (!ticket.assignee) return false;
    // Only assignee can change workflow
    return ticket.assignee === user.id;
  };

  // Check if user can start work on this ticket
  const canStartWork = () => {
    if (!ticket || !user) return false;
    // Manager can always start work
    if (isManager) return true;
    // If already assigned to someone else, can't start work
    if (ticket.assignee && ticket.assignee !== user.id) return false;
    // If unassigned or assigned to current user, can start work
    return !ticket.assignee || ticket.assignee === user.id;
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const ticketData = await ticketsApi.getTicket(ticketId);
      setTicket(ticketData);
      
      // Fetch project details
      const projectData = await projectsApi.getProject(ticketData.project);
      setProject(projectData);
    } catch (error) {
      showToastMessage('Failed to load ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersData = await authApi.getUsers();
      setUsers(usersData.filter(u => u.is_active));
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchUsers();
  }, [ticketId]);

  const handleStatusChange = async (newStatus: TicketStatus) => {
    // Check if user can change workflow
    if (!canChangeWorkflow()) {
      showToastMessage('Only the assigned user or manager can change the workflow', 'error');
      return;
    }

    try {
      await ticketsApi.updateStatus(ticketId, newStatus);
      showToastMessage(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
      setShowStatusModal(false);
      fetchTicket();
      // Refresh work logs and activity logs after status change
      fetchActivityLogs();
      if (isManager) {
        fetchWorkLogs();
        fetchActiveSession();
      }
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleAssign = async (userId: number | null) => {
    try {
      await ticketsApi.updateTicket(ticketId, { assignee: userId });
      showToastMessage(userId ? 'Ticket assigned' : 'Ticket unassigned', 'success');
      setShowAssignModal(false);
      fetchTicket();
    } catch (error) {
      showToastMessage('Failed to assign ticket', 'error');
    }
  };

  const handleDeleteTicket = async () => {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) return;
    
    try {
      await ticketsApi.deleteTicket(ticketId);
      showToastMessage('Ticket deleted successfully', 'success');
      // Redirect to tickets list
      window.location.href = '/protected/dashboard/tickets';
    } catch (error) {
      showToastMessage('Failed to delete ticket', 'error');
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ticketsApi.updateTicket(ticketId, editData);
      showToastMessage('Ticket updated successfully', 'success');
      setShowEditModal(false);
      fetchTicket();
    } catch (error) {
      showToastMessage('Failed to update ticket', 'error');
    }
  };

  // Time tracking functions - only for managers
  const fetchWorkLogs = async () => {
    if (!isManager) return;
    try {
      const [logs, total] = await Promise.all([
        timelogsApi.getWorkLogs(ticketId),
        timelogsApi.getTotalTime(ticketId),
      ]);
      setWorkLogs(logs);
      setTotalTime(total);
    } catch (error) {
      console.error('Failed to fetch work logs');
    }
  };

  const fetchActiveSession = async () => {
    try {
      const session = await timelogsApi.getActiveSession();
      setActiveSession(session);
      
      if (session.active && session.workLog?.ticket === ticketId) {
        setIsTracking(true);
        setActiveWorkLogUserId(session.workLog.user);
        // Only show timer if current user is the one who started work
        if (session.workLog.user === currentUserId) {
          setElapsedSeconds((session.elapsed_minutes || 0) * 60);
        }
      } else if (session.active && session.workLog?.ticket !== ticketId) {
        // Active session on different ticket
        setIsTracking(false);
        setElapsedSeconds(0);
        setActiveWorkLogUserId(null);
      } else {
        setIsTracking(false);
        setElapsedSeconds(0);
        setActiveWorkLogUserId(null);
      }
    } catch (error) {
      console.error('Failed to fetch active session');
    }
  };

  const startTracking = async () => {
    try {
      // If ticket is unassigned, auto-assign to current user first
      if (ticket && !ticket.assignee) {
        await ticketsApi.updateTicket(ticketId, { assignee: user?.id });
        showToastMessage('You have been assigned to this ticket', 'success');
        // Refresh ticket to get updated assignee
        await fetchTicket();
      }
      
      const workLog = await timelogsApi.startWork(ticketId);
      showToastMessage('Time tracking started', 'success');
      
      // Immediately update local state for instant UI feedback
      setIsTracking(true);
      setActiveWorkLogUserId(user?.id || null);
      setElapsedSeconds(0); // Start from 0 seconds
      setActiveSession({
        active: true,
        workLog: workLog,
        elapsedMinutes: 0
      });
      
      if (isManager) {
        fetchWorkLogs();
      }
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to start tracking', 'error');
    }
  };

  const stopTracking = async () => {
    if (!activeSession?.workLog?.id) return;
    try {
      await timelogsApi.stopWork(activeSession.workLog.id);
      showToastMessage('Time tracking stopped', 'success');
      setIsTracking(false);
      setElapsedSeconds(0);
      setActiveWorkLogUserId(null);
      fetchActiveSession();
      if (isManager) {
        fetchWorkLogs();
      }
    } catch (error) {
      showToastMessage('Failed to stop tracking', 'error');
    }
  };

  // Comments functions
  const fetchComments = async () => {
    try {
      const data = await commentsApi.getCommentsByTicket(ticketId);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    try {
      await commentsApi.createComment({
        ticket: ticketId,
        content: newComment.trim()
      });
      setNewComment('');
      fetchComments();
      showToastMessage('Comment added', 'success');
    } catch (error) {
      showToastMessage('Failed to add comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await commentsApi.deleteComment(commentId);
      fetchComments();
      showToastMessage('Comment deleted', 'success');
    } catch (error) {
      showToastMessage('Failed to delete comment', 'error');
    }
  };

  // Activity logs function
  const fetchActivityLogs = async () => {
    try {
      const data = await activityApi.getActivityByTicket(ticketId);
      setActivityLogs(data);
    } catch (error) {
      console.error('Failed to fetch activity logs');
    }
  };

  // Timer effect - update every second for smooth display (only for the user who started work)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && activeWorkLogUserId === currentUserId) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, activeWorkLogUserId, currentUserId]);

  // Initialize edit data when ticket loads
  useEffect(() => {
    if (ticket) {
      setEditData({
        title: ticket.title,
        description: ticket.description,
        type: ticket.type,
        priority: ticket.priority,
      });
    }
  }, [ticket]);

  // Fetch work logs, active session, comments, and activity logs when ticket loads
  useEffect(() => {
    if (ticketId) {
      fetchActiveSession();
      fetchComments();
      fetchActivityLogs();
      if (isManager) {
        fetchWorkLogs();
      }
    }
  }, [ticketId, isManager]);

  const validNextStatuses = ticket ? statusFlow[ticket.status] : [];
  const userCanChangeWorkflow = canChangeWorkflow();
  const isCurrentUserWorking = activeWorkLogUserId === currentUserId;
  const someoneElseWorking = activeWorkLogUserId && activeWorkLogUserId !== currentUserId;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-white mb-4">Ticket Not Found</h1>
          <Link href="/protected/dashboard/tickets" className="btn-primary">
            Back to Tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white">Dashboard</Link>
        <span className="text-slate-500">/</span>
        <Link href="/protected/dashboard/tickets" className="text-slate-400 hover:text-white">Tickets</Link>
        <span className="text-slate-500">/</span>
        <span className="text-white">{ticket.ticket_id}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{ticket.title}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[ticket.status]}`}>
              {ticket.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="text-slate-400">{ticket.ticket_id} • Created by {ticket.created_by}</p>
          
          {/* Show assignment/work status */}
          {ticket.assignee && ticket.assignee !== user?.id ? (
            <div className="mt-2 flex items-center gap-2 text-amber-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Assigned to {ticket.assignee_name} - You can only comment</span>
            </div>
          ) : someoneElseWorking ? (
            <div className="mt-2 flex items-center gap-2 text-amber-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Someone else is currently working on this ticket</span>
            </div>
          ) : null}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Change Status Button - Only enabled for assignee/manager */}
          <button
            onClick={() => userCanChangeWorkflow ? setShowStatusModal(true) : showToastMessage('Only the assigned user or manager can change workflow', 'error')}
            className={`btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg ${!userCanChangeWorkflow ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Change Status
          </button>
          
          {/* Start/Stop Time Tracking Button Logic */}
          {/* Case 1: Currently tracking (shows Work Started for everyone) */}
          {isTracking ? (
            <div className="flex items-center gap-2">
              {/* Running Timer Display - Show to assignee and the person working */}
              {(isCurrentUserWorking || ticket?.assignee === user?.id || isManager) && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-mono font-semibold">
                    {formatActiveTime(elapsedSeconds)}
                  </span>
                </div>
              )}
              {/* Work Started Button - Disabled, shows for everyone when work is active */}
              <button
                disabled
                className="bg-amber-600/50 text-white flex items-center gap-2 px-4 py-2 rounded-lg cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Work Started
              </button>
            </div>
          ) : /* Case 2: Not tracking and assigned to current user */ 
          !isTracking && ticket.assignee === user?.id ? (
            <button
              onClick={startTracking}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Work
            </button>
          ) : /* Case 3: Not tracking and assigned to someone else (not manager) */ 
          !isTracking && ticket.assignee && ticket.assignee !== user?.id && !isManager ? (
            <button
              disabled
              className="bg-slate-600/50 text-slate-300 flex items-center gap-2 px-4 py-2 rounded-lg cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Assigned
            </button>
          ) : /* Case 4: Unassigned - anyone can start work (auto-assigns) */ 
          !isTracking && !ticket.assignee ? (
            <button
              onClick={startTracking}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Work
            </button>
          ) : /* Case 5: Manager override - can work on anything */ 
          isManager && (
            <button
              onClick={startTracking}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Work
            </button>
          )}
          
          {/* Only creator or manager/admin can edit/delete */}
          {(ticket.created_by === user?.username || isManager) && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={handleDeleteTicket}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Description</h2>
            <p className="text-slate-300 whitespace-pre-wrap">{ticket.description || 'No description provided.'}</p>
          </div>

          {/* Work Logs Section - Only visible to managers */}
          {isManager && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Work Logs</h2>
                {totalTime && (
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Total Time</p>
                    <p className="text-xl font-bold text-green-400">
                      {totalTime.total_hours > 0 ? `${totalTime.total_hours}h` : `${totalTime.total_minutes}m`}
                    </p>
                  </div>
                )}
              </div>
              
              {workLogs.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-400">No work logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workLogs.map((log) => (
                    <div key={log.id} className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold">
                          {log.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{log.user_name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(log.start_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">
                          {log.end_time 
                            ? formatElapsedTime(log.duration_minutes)
                            : <span className="text-amber-400 animate-pulse">In Progress</span>
                          }
                        </p>
                        {log.notes && (
                          <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments & Activity Section */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            {/* Tabs */}
            <div className="flex items-center gap-4 mb-6 border-b border-slate-700">
              <button
                onClick={() => setActiveTab('comments')}
                className={`pb-2 text-lg font-semibold transition-colors ${
                  activeTab === 'comments' 
                    ? 'text-white border-b-2 border-sky-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`pb-2 text-lg font-semibold transition-colors ${
                  activeTab === 'activity' 
                    ? 'text-white border-b-2 border-sky-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Activity ({activityLogs.length})
              </button>
            </div>

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="mb-6">
                  <div className="flex gap-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={2}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-sky-400 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Post
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-slate-400">No comments yet. Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-700/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {comment.author_name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-white font-medium">{comment.author_name}</p>
                                <p className="text-xs text-slate-400">
                                  {new Date(comment.created_at).toLocaleString()}
                                  {comment.updated_at !== comment.created_at && ' (edited)'}
                                </p>
                              </div>
                              {comment.author.username === user?.username && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                  title="Delete comment"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <p className="text-slate-300 mt-2 whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activityLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-slate-400">No activity recorded yet</p>
                  </div>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 bg-slate-700/30 rounded-lg p-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        log.action === 'create' ? 'bg-green-500/20 text-green-400' :
                        log.action === 'update' ? 'bg-blue-500/20 text-blue-400' :
                        log.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                        log.action === 'status_change' ? 'bg-purple-500/20 text-purple-400' :
                        log.action === 'work_log' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {log.action === 'create' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        {log.action === 'update' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )}
                        {log.action === 'delete' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                        {log.action === 'status_change' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        {log.action === 'work_log' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {log.action === 'comment' && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300">
                          <span className="text-white font-medium">{log.user_name || 'System'}</span>
                          {' '}{log.description}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Ticket Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Type</span>
                <span className="text-white capitalize">{ticket.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Priority</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ticket.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                  ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  ticket.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {ticket.priority.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Project</span>
                <Link href={`/protected/dashboard/projects/${ticket.project}`} className="text-sky-400 hover:text-sky-300">
                  {ticket.project_name}
                </Link>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Created</span>
                <span className="text-white">{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Updated</span>
                <span className="text-white">{new Date(ticket.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Assignee</h3>
              {(isManager || !ticket.assignee) && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="text-sky-400 hover:text-sky-300 text-sm"
                >
                  {ticket.assignee ? 'Change' : 'Assign'}
                </button>
              )}
            </div>
            {ticket.assignee ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold">
                  {ticket.assignee_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{ticket.assignee_name}</p>
                  <p className="text-xs text-slate-400">Assigned</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-slate-400">Unassigned</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Workflow */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Status Workflow</h3>
            <div className="space-y-2">
              {validNextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => userCanChangeWorkflow && handleStatusChange(status)}
                  disabled={!userCanChangeWorkflow}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-slate-700/50 ${statusColors[status]} ${!userCanChangeWorkflow ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="font-medium">{status.replace('_', ' ').toUpperCase()}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              {validNextStatuses.length === 0 && (
                <p className="text-slate-400 text-center py-4">No valid status transitions</p>
              )}
              {!userCanChangeWorkflow && (
                <p className="text-xs text-amber-400 text-center mt-2">
                  Only the assigned user or manager can change workflow
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Change Status</h2>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <p className="text-slate-400 mb-4">Current: <span className="text-white">{ticket.status.replace('_', ' ').toUpperCase()}</span></p>
              {validNextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${statusColors[status]} hover:opacity-80`}
                >
                  <span className="font-medium">{status.replace('_', ' ').toUpperCase()}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Assign Ticket</h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <button
                onClick={() => handleAssign(null)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors mb-2"
              >
                <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-white">Unassign</span>
              </button>
              <div className="border-t border-slate-700 my-2"></div>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAssign(u.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-slate-400">{u.username} • {u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && ticket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Edit Ticket</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="input-field w-full"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={4}
                  className="input-field w-full resize-none"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                  <select
                    className="input-field w-full"
                    value={editData.type}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value as TicketType })}
                  >
                    <option value="bug">Bug</option>
                    <option value="task">Task</option>
                    <option value="feature">Feature</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                  <select
                    className="input-field w-full"
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value as TicketPriority })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
