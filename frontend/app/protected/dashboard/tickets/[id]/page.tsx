'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ticketsApi, Ticket, TicketStatus, TicketMedia, TicketComment } from '@/lib/tickets';
import { projectsApi, Project } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';
import { activityApi, ActivityLog } from '@/lib/activity';
import { timelogsApi, TicketActiveSession } from '@/lib/timelogs';
import Markdown from '@/components/Markdown';
import { FileUploadZone } from '@/components/file-upload-zone';
import { CommentMentionInput, renderCommentContent } from '@/components/comment-mentions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import api from '@/lib/api';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

const resolveMediaUrl = (url: string) => {
  if (!url) return '';

  let resolved = url;
  if (resolved.startsWith('http://backend:') || resolved.startsWith('http://backend/')) {
    resolved = resolved.replace(/^http:\/\/backend(?::\d+)?/, API_ORIGIN);
  }

  if (resolved.startsWith('http')) {
    return resolved;
  }

  const normalized = resolved.startsWith('/') ? resolved : `/${resolved}`;
  if (normalized.startsWith('/api/')) {
    return `${API_ORIGIN}${normalized}`;
  }
  if (normalized.startsWith('/media/')) {
    return `${API_ORIGIN}/api${normalized}`;
  }
  return `${API_ORIGIN}/api/media/${resolved.replace(/^\//, '')}`;
};

const toMediaFetchPath = (fileValue: string) => {
  if (!fileValue) return '';

  if (fileValue.startsWith('http')) {
    const parsed = new URL(resolveMediaUrl(fileValue));
    return `${parsed.pathname.replace(/^\/api/, '')}${parsed.search}`;
  }

  if (fileValue.startsWith('/api/')) {
    return `${fileValue.slice('/api'.length)}`;
  }
  if (fileValue.startsWith('/media/')) {
    return fileValue;
  }
  if (fileValue.startsWith('media/')) {
    return `/${fileValue}`;
  }
  return `/media/${fileValue.replace(/^\//, '')}`;
};

const fetchMediaBlobUrl = async (fileValue: string): Promise<string> => {
  const path = toMediaFetchPath(fileValue);
  const response = await api.get(path, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
};

const isImageMedia = (media: TicketMedia) => {
  if (media.file_type === 'image') return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(media.file_name);
};

type ViewingMedia = {
  fileName: string;
  file: string;
  kind: 'image' | 'pdf' | 'video' | 'file';
};

const resolveMediaKind = (media: TicketMedia): ViewingMedia['kind'] => {
  if (isImageMedia(media)) return 'image';
  if (media.file_type === 'video') return 'video';
  if (media.file_name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
};

interface MediaPreviewDialogProps {
  media: ViewingMedia;
  onClose: () => void;
}

function MediaPreviewDialog({ media, onClose }: MediaPreviewDialogProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        blobUrl = await fetchMediaBlobUrl(media.file);
        if (!cancelled) {
          setSrc(blobUrl);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setSrc(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [media.file]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = media.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 gap-3">
          <h3 className="text-sm font-medium text-white truncate flex-1">{media.fileName}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!src}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              aria-label="Close preview"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-950/50 flex items-center justify-center min-h-[200px]">
          {loading ? (
            <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          ) : loadError ? (
            <p className="text-slate-400 text-sm">Failed to load preview.</p>
          ) : media.kind === 'image' ? (
            <img
              src={src!}
              alt={media.fileName}
              className="max-h-[75vh] max-w-full object-contain rounded-lg"
            />
          ) : media.kind === 'pdf' ? (
            <iframe
              src={src!}
              title={media.fileName}
              className="w-full h-[75vh] rounded-lg border-none bg-white"
            />
          ) : media.kind === 'video' ? (
            <video
              src={src!}
              controls
              className="max-h-[75vh] max-w-full rounded-lg"
            />
          ) : (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-400 text-sm">Preview not available for this file type.</p>
              <p className="text-slate-500 text-xs mt-1">Use Download to save the file.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProtectedImageThumbnailProps {
  media: TicketMedia;
  onView: (media: TicketMedia) => void;
  className?: string;
}

function ProtectedImageThumbnail({ media, onView, className }: ProtectedImageThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        objectUrl = await fetchMediaBlobUrl(media.file);
        if (!cancelled) {
          setSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setSrc(resolveMediaUrl(media.file));
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [media.file, media.id]);

  if (!src) {
    return <div className={`bg-slate-700/50 animate-pulse ${className || 'w-28 h-28 rounded-lg border border-slate-600'}`} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => onView(media)}
      className="block w-full"
      aria-label={`View ${media.file_name}`}
    >
      <img
        src={src}
        alt={media.file_name}
        className={className || 'w-28 h-28 object-cover rounded-lg border border-slate-600 hover:border-sky-500/50 transition-colors'}
      />
    </button>
  );
}

const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  new: { label: 'New', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  qa: { label: 'QA', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  closed: { label: 'Closed', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
  reopened: { label: 'Reopened', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
};

export default function TicketDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<ViewingMedia | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [activeSession, setActiveSession] = useState<TicketActiveSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const [editData, setEditData] = useState({
    title: '',
    description: '',
    type: 'task' as 'bug' | 'task' | 'feature',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    status: 'new' as TicketStatus,
    assignees: [] as number[],
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string | string[]>>>({});

  const openMediaPreview = (media: TicketMedia) => {
    setViewingMedia({
      fileName: media.file_name,
      file: media.file,
      kind: resolveMediaKind(media),
    });
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ticketData, projectsData, usersData, activityData] = await Promise.all([
          ticketsApi.getTicket(ticketId),
          projectsApi.getProjects(),
          authApi.getUsers(),
          activityApi.getActivityByTicket(ticketId).catch(() => []),
        ]);
        setTicket(ticketData);
        setProjects(projectsData);
        setUsers(usersData.filter(u => u.is_active));
        setActivities(activityData);
        setEditData({
          title: ticketData.title,
          description: ticketData.description,
          type: ticketData.type,
          priority: ticketData.priority,
          status: ticketData.status,
          assignees: ticketData.assignees || [],
        });
      } catch (error: any) {
        showToastMessage(error.response?.data?.detail || 'Failed to load ticket', 'error');
        router.push('/protected/dashboard/tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticketId, router]);

  const fetchActiveSession = useCallback(async () => {
    if (!ticket) return;
    const isAssignee = ticket.assignees?.includes(Number(user?.id));
    const canViewStopwatch = user?.role === 'admin' || user?.role === 'manager' || isAssignee;
    if (!canViewStopwatch) return;

    try {
      const session = await timelogsApi.getTicketActiveSession(ticketId);
      if (session.active) {
        setActiveSession(session);
        setElapsedTime(session.elapsed_seconds || 0);
      } else {
        setActiveSession(null);
        setElapsedTime(0);
      }
    } catch (error) {
      setActiveSession(null);
      setElapsedTime(0);
    }
  }, [ticket, ticketId, user?.id, user?.role, ticket?.assignees]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  useEffect(() => {
    if (ticket) {
      if (ticket.status === 'in_progress' || ticket.status === 'reopened' || ticket.status === 'qa') {
        fetchActiveSession();
      } else {
        setActiveSession(null);
        setElapsedTime(0);
      }
    }
  }, [ticket?.status, ticket?.assignees, fetchActiveSession]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setFieldErrors({});
      const { assignees: _, status: _s, ...savePayload } = editData;
      const updated = await ticketsApi.updateTicket(ticketId, savePayload);
      setTicket({ ...ticket!, ...updated });
      setIsEditing(false);
      showToastMessage('Ticket updated successfully', 'success');
    } catch (error: any) {
      const data = error.response?.data;
      if (data && typeof data === 'object' && !data.detail) {
        setFieldErrors(data);
      }
      showToastMessage(data?.detail || 'Failed to update ticket', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      setSaving(true);
      const updated = await ticketsApi.updateStatus(ticketId, newStatus);
      const freshTicket = await ticketsApi.getTicket(ticketId);
      setTicket(freshTicket);
      setEditData({
        ...editData,
        status: freshTicket.status,
        assignees: freshTicket.assignees || []
      });

      if (newStatus === 'in_progress') {
        await fetchActiveSession();
      } else if (newStatus === 'closed') {
        setActiveSession(null);
        setElapsedTime(0);
      } else if (newStatus === 'reopened') {
        setActiveSession(null);
        setElapsedTime(0);
      }

      showToastMessage('Status updated successfully', 'success');
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingMedia(true);
      for (const file of Array.from(files)) {
        const media = await ticketsApi.uploadMedia(ticketId, file);
        setTicket(prev => prev ? { ...prev, media_files: [...prev.media_files, media] } : null);
      }
      showToastMessage('Media uploaded successfully', 'success');
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to upload media', 'error');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    try {
      await ticketsApi.deleteMedia(ticketId, mediaId);
      setTicket(prev => prev ? { ...prev, media_files: prev.media_files.filter(m => m.id !== mediaId) } : null);
      showToastMessage('Media deleted successfully', 'success');
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to delete media', 'error');
    }
  };

  const handleOpenAttachment = (media: TicketMedia) => {
    openMediaPreview(media);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() && commentImages.length === 0) return;

    try {
      setSubmittingComment(true);
      const comment = await ticketsApi.addComment(ticketId, newComment.trim(), commentImages);
      setTicket(prev => prev ? { ...prev, comments: [...prev.comments, comment] } : null);
      setNewComment('');
      setCommentImages([]);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
      showToastMessage('Comment added', 'success');
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || error.response?.data?.error || 'Failed to add comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setCommentImages((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const handleRemoveCommentImage = (index: number) => {
    setCommentImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTicketClick = () => {
    if (!ticket) return;
    if (ticket.created_by_id !== user?.id) {
      showToastMessage("You can't delete this ticket. Only the creator can delete it.", 'error');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteTicket = async () => {
    try {
      setDeletingTicket(true);
      await ticketsApi.deleteTicket(ticketId);
      showToastMessage('Ticket deleted successfully', 'success');
      router.push('/protected/dashboard/tickets');
    } catch (error: any) {
      showToastMessage(
        error.response?.data?.error || error.response?.data?.detail || 'Failed to delete ticket',
        'error',
      );
    } finally {
      setDeletingTicket(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSelfAssign = async () => {
    try {
      setSaving(true);
      const updated = await ticketsApi.selfAssign(ticketId);
      const assignees = updated.assignees || [];
      setTicket({ ...ticket!, assignees, assignees_list: updated.assignees_list });
      setEditData(prev => ({ ...prev, assignees }));
      showToastMessage('Added yourself to ticket', 'success');
      const freshTicket = await ticketsApi.getTicket(ticketId);
      setTicket(freshTicket);
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || error.response?.data?.detail || 'Failed to assign', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (targetUserId: number) => {
    try {
      setSaving(true);
      setShowAssignDropdown(false);
      const updated = await ticketsApi.assignTicket(ticketId, targetUserId);
      const assignees = updated.assignees || [];
      setTicket({ ...ticket!, assignees, assignees_list: updated.assignees_list });
      setEditData(prev => ({ ...prev, assignees }));
      showToastMessage('Assignee added', 'success');
      const freshTicket = await ticketsApi.getTicket(ticketId);
      setTicket(freshTicket);
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || error.response?.data?.detail || 'Failed to assign', 'error');
    } finally {
      setSaving(false);
    }
  };

  const projectMembers = users.filter(u =>
    ticket?.project && (
      projects.find(p => p.id === ticket.project)?.members?.some(m => m.user.id === u.id) ||
      u.role === 'admin' ||
      u.role === 'manager'
    )
  );

  const mentionableUsers = useMemo(() => {
    if (!ticket) return [];

    const project = projects.find((p) => p.id === ticket.project);
    const byId = new Map<number, { id: number; username: string; first_name?: string; last_name?: string }>();

    project?.members?.forEach((member) => {
      if (member.user.id !== user?.id) {
        byId.set(member.user.id, member.user);
      }
    });

    ticket.assignees_list?.forEach((assignee) => {
      if (assignee.id !== user?.id) {
        byId.set(assignee.id, assignee);
      }
    });

    return Array.from(byId.values());
  }, [ticket, projects, user?.id]);

  const getValidStatusTransitions = (currentStatus: TicketStatus): TicketStatus[] => {
    const transitions: Record<TicketStatus, TicketStatus[]> = {
      new: ['in_progress'],
      in_progress: ['qa', 'reopened'],
      qa: ['closed', 'in_progress', 'reopened'],
      closed: ['reopened'],
      reopened: ['in_progress'],
    };
    return transitions[currentStatus] || [];
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isAssignee = ticket?.assignees?.includes(Number(user?.id));
  const canViewStopwatch = user?.role === 'admin' || user?.role === 'manager' || isAssignee;

  const canEdit = user?.role === 'admin' || user?.role === 'manager' || ticket?.created_by_id === user?.id;
  const canChangeStatus = isAssignee || user?.role === 'admin' || user?.role === 'manager';
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const isCreator = ticket?.created_by_id === user?.id;
  const canViewActivity = user?.role === 'admin' || user?.role === 'manager';
  const isProjectMember = projectMembers.some(m => m.id === user?.id);
  const canAssign = user?.role === 'admin' || user?.role === 'manager' || isCreator || isProjectMember;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-700/30 rounded w-1/3"></div>
          <div className="h-96 bg-slate-700/30 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="form-card p-12 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Ticket Not Found</h2>
          <Link href="/protected/dashboard/tickets" className="btn-primary mt-4">Back to Tickets</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <Link href="/protected/dashboard" className="text-slate-400 hover:text-white text-sm">Dashboard</Link>
        <span className="text-slate-600">/</span>
        <Link href="/protected/dashboard/tickets" className="text-slate-400 hover:text-white text-sm">Tickets</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white text-sm font-medium">{ticket.ticket_id}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="form-card p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Title</label>
                  <input type="text" className="input-field w-full" value={editData.title} onChange={(e) => { setEditData({ ...editData, title: e.target.value }); setFieldErrors({ ...fieldErrors, title: undefined }); }} />
                  {fieldErrors.title && <p className="text-red-400 text-xs mt-1">{Array.isArray(fieldErrors.title) ? fieldErrors.title[0] : fieldErrors.title}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Description</label>
                  <textarea rows={6} className="input-field w-full resize-none" value={editData.description} onChange={(e) => { setEditData({ ...editData, description: e.target.value }); setFieldErrors({ ...fieldErrors, description: undefined }); }} />
                  {fieldErrors.description && <p className="text-red-400 text-xs mt-1">{Array.isArray(fieldErrors.description) ? fieldErrors.description[0] : fieldErrors.description}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Type</label>
                    <select className="input-field w-full" value={editData.type} onChange={(e) => { setEditData({ ...editData, type: e.target.value as any }); setFieldErrors({ ...fieldErrors, type: undefined }); }}>
                      <option value="bug">Bug</option>
                      <option value="task">Task</option>
                      <option value="feature">Feature</option>
                    </select>
                    {fieldErrors.type && <p className="text-red-400 text-xs mt-1">{Array.isArray(fieldErrors.type) ? fieldErrors.type[0] : fieldErrors.type}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Priority</label>
                    <select className="input-field w-full" value={editData.priority} onChange={(e) => { setEditData({ ...editData, priority: e.target.value as any }); setFieldErrors({ ...fieldErrors, priority: undefined }); }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    {fieldErrors.priority && <p className="text-red-400 text-xs mt-1">{Array.isArray(fieldErrors.priority) ? fieldErrors.priority[0] : fieldErrors.priority}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2">{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-white">{ticket.title}</h1>
                    <p className="text-sm text-slate-500 mt-1">{ticket.ticket_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600">
                        Edit
                      </button>
                    )}
                    <button
                      onClick={handleDeleteTicketClick}
                      className="px-3 py-1.5 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 border border-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  <Markdown content={ticket.description || '*No description provided*'} />
                </div>
              </div>
            )}
          </div>

          <div className="form-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Attachments</h3>
            </div>
            {(isProjectMember || canEdit) && (
              <div className="mb-6">
                <FileUploadZone
                  onFilesSelected={async (files) => {
                    try {
                      setUploadingMedia(true);
                      for (const file of files) {
                        const media = await ticketsApi.uploadMedia(ticketId, file);
                        setTicket(prev => prev ? { ...prev, media_files: [...prev.media_files, media] } : null);
                      }
                      showToastMessage('Media uploaded successfully', 'success');
                    } catch (error: any) {
                      showToastMessage(error.response?.data?.detail || 'Failed to upload media', 'error');
                    } finally {
                      setUploadingMedia(false);
                    }
                  }}
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx"
                  placeholder="Click, drag, or paste files to attach"
                  className="bg-slate-700/20"
                />
              </div>
            )}
            {ticket.media_files && ticket.media_files.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ticket.media_files.map((media) => (
                  <div key={media.id} className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors group">
                    {isImageMedia(media) ? (
                      <div className="relative aspect-video bg-slate-600 rounded-lg overflow-hidden mb-2">
                        <ProtectedImageThumbnail
                          media={media}
                          onView={openMediaPreview}
                          className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenAttachment(media)}
                        className="block w-full text-left"
                        aria-label={`Open ${media.file_name}`}
                      >
                        {media.file_type === 'video' ? (
                          <div className="aspect-video bg-slate-600 rounded-lg overflow-hidden mb-2 flex items-center justify-center hover:bg-slate-500/80 transition-colors">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="aspect-video bg-slate-600 rounded-lg overflow-hidden mb-2 flex items-center justify-center hover:bg-slate-500/80 transition-colors">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )}
                    <p className="text-xs text-slate-300 truncate">{media.file_name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(media.file_size)}</p>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteMedia(media.id)}
                        className="mt-2 w-full py-1 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <p className="text-sm">No attachments yet</p>
              </div>
            )}
          </div>

          <div className="form-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Comments ({ticket.comments?.length || 0})</h3>
            <div className="mb-4">
              <CommentMentionInput
                value={newComment}
                onChange={setNewComment}
                mentionableUsers={mentionableUsers}
                disabled={submittingComment}
              />
              <input
                ref={commentFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleCommentImageSelect}
              />
              {commentImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {commentImages.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative group">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        width={80}
                        height={80}
                        className="w-20 h-20 object-cover rounded-lg border border-slate-600"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCommentImage(index)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => commentFileInputRef.current?.click()}
                  disabled={submittingComment}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Attach images
                </button>
                <button
                  onClick={handleAddComment}
                  disabled={submittingComment || (!newComment.trim() && commentImages.length === 0)}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {submittingComment ? 'Posting...' : 'Add Comment'}
                </button>
              </div>
            </div>

            {ticket.comments && ticket.comments.length > 0 ? (
              <div className="space-y-4">
                {ticket.comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                        <span className="text-xs font-medium text-sky-400">
                          {comment.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white font-medium text-sm">{comment.user_name}</span>
                      </div>
                      <span className="text-slate-500 text-xs ml-auto">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap break-words">
                      {comment.content ? renderCommentContent(comment.content) : null}
                    </p>
                    {comment.media_files && comment.media_files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {comment.media_files.map((media) => (
                          <ProtectedImageThumbnail
                            key={media.id}
                            media={media}
                            onView={openMediaPreview}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No comments yet</p>
            )}
          </div>

          {canViewActivity && (
            <div className="form-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-sky-400">
                          {activity.user?.first_name && activity.user?.last_name
                            ? `${activity.user.first_name[0]}${activity.user.last_name[0]}`.toUpperCase()
                            : activity.user?.username?.slice(0, 2).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">
                            {activity.user?.first_name && activity.user?.last_name
                              ? `${activity.user.first_name} ${activity.user.last_name}`
                              : activity.user?.username || 'Unknown'}
                          </span>
                        </div>
                        <p className="text-slate-300">{activity.description}</p>
                        <p className="text-slate-500 text-xs">{formatDateTime(activity.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No activity yet</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="form-card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Assignees</label>
              {ticket.assignees_list && ticket.assignees_list.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {ticket.assignees_list.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-2 py-1.5 group">
                        <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-medium text-sky-400">
                            {(a.display_name || a.username).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-white truncate max-w-[100px]">{a.display_name || a.username}</span>
                        {canAssign && ticket.status !== 'closed' && (isManagerOrAdmin || isCreator || a.id === user?.id) && (
                          <button
                            onClick={async () => {
                              try {
                                setSaving(true);
                                await ticketsApi.unassignTicket(ticketId, a.id);
                                const fresh = await ticketsApi.getTicket(ticketId);
                                setTicket(fresh);
                                setEditData(prev => ({ ...prev, assignees: fresh.assignees || [] }));
                                showToastMessage('Assignee removed', 'success');
                              } catch (err: any) {
                                showToastMessage(err.response?.data?.error || 'Failed to remove', 'error');
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving}
                            className="text-slate-400 hover:text-red-400 text-xs p-0.5"
                            title="Remove"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canAssign && ticket.status !== 'closed' && (
                    <div className="relative">
                      <button
                        onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                        disabled={saving}
                        className="text-sky-400 hover:text-sky-300 text-xs flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add assignee
                      </button>
                      {showAssignDropdown && (
                        <div className="absolute left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                          <div className="p-2 max-h-48 overflow-y-auto">
                            {!ticket.assignees?.includes(Number(user?.id)) && (
                              <button
                                onClick={() => handleAssign(Number(user?.id))}
                                disabled={saving}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                              >
                                Self-assign (add me)
                              </button>
                            )}
                            {projectMembers.filter(m => !ticket.assignees?.includes(m.id)).map(member => (
                              <button
                                key={member.id}
                                onClick={() => handleAssign(member.id)}
                                disabled={saving}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2"
                              >
                                <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-medium text-sky-400">
                                    {member.first_name && member.last_name
                                      ? `${member.first_name[0]}${member.last_name[0]}`.toUpperCase()
                                      : member.username.slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <span className="truncate">{member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username}</span>
                              </button>
                            ))}
                            {projectMembers.filter(m => !ticket.assignees?.includes(m.id)).length === 0 && ticket.assignees?.includes(Number(user?.id)) && (
                              <p className="text-xs text-slate-500 px-2 py-1">All project members assigned</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="text-slate-500 italic text-sm">Unassigned</span>
                  {ticket.status !== 'closed' && (
                    <div className="mt-2">
                      {canAssign ? (
                        <div className="relative">
                          <button
                            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                            disabled={saving}
                            className="btn-primary px-3 py-1.5 text-sm"
                          >
                            Assign
                          </button>
                          {showAssignDropdown && (
                            <div className="absolute left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                              <div className="p-2">
                                <button
                                  onClick={() => handleAssign(Number(user?.id))}
                                  disabled={saving}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                                >
                                  Self-assign (add me)
                                </button>
                                <div className="border-t border-slate-700 my-1"></div>
                                {projectMembers.filter(m => m.id !== user?.id).map(member => (
                                  <button
                                    key={member.id}
                                    onClick={() => handleAssign(member.id)}
                                    disabled={saving}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                                      <span className="text-[10px] font-medium text-sky-400">
                                        {member.first_name && member.last_name
                                          ? `${member.first_name[0]}${member.last_name[0]}`.toUpperCase()
                                          : member.username.slice(0, 2).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="truncate">{member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={handleSelfAssign}
                          disabled={saving}
                          className="btn-primary px-3 py-1.5 text-sm"
                        >
                          Self-assign
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-700/50">
              <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
              <div className={`inline-flex px-3 py-2 rounded-lg text-sm font-medium w-full justify-center ${statusConfig[ticket.status].bgColor} ${statusConfig[ticket.status].color}`}>
                {statusConfig[ticket.status].label}
              </div>
              {canChangeStatus && (
                <div className="flex flex-col gap-2 mt-2">
                  {getValidStatusTransitions(ticket.status).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={saving}
                      className={`w-full py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${statusConfig[status].bgColor} ${statusConfig[status].color} ${statusConfig[status].borderColor} hover:bg-opacity-20`}
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                      {saving ? 'Updating...' : `Move to ${statusConfig[status].label}`}
                    </button>
                  ))}
                </div>
              )}
              {!canChangeStatus && ticket.status !== 'closed' && (
                <p className="text-xs text-slate-500 mt-2">Only assignees can change status</p>
              )}
            </div>

            {canViewStopwatch && activeSession && (
              <div className="pt-2 border-t border-slate-700/50">
                <label className="block text-sm font-medium text-slate-400 mb-1">Time Tracking</label>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-2xl font-mono text-amber-400">{formatTime(elapsedTime)}</span>
                    </div>
                    <span className="text-xs text-slate-500">{activeSession.user_name}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-700/50">
              <label className="block text-sm font-medium text-slate-400 mb-1">Timeline</label>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Created</span>
                  <span className="text-slate-300">{formatDateTime(ticket.created_at)}</span>
                </div>
                {ticket.in_progress_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Started</span>
                    <span className="text-amber-400">{formatDateTime(ticket.in_progress_at)}</span>
                  </div>
                )}
                {ticket.qa_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">QA</span>
                    <span className="text-purple-400">{formatDateTime(ticket.qa_at)}</span>
                  </div>
                )}
                {ticket.closed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Completed</span>
                    <span className="text-green-400">{formatDateTime(ticket.closed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ticket.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  ticket.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-500/20 text-slate-400'
                }`}>
                {ticket.priority.toUpperCase()}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
              <span className="text-white capitalize">{ticket.type}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Project</label>
              <Link href={`/protected/dashboard/projects/${ticket.project}`} className="text-sky-400 hover:underline text-sm">
                {ticket.project_name}
              </Link>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Created By</label>
              <span className="text-white text-sm">{ticket.created_by}</span>
            </div>
          </div>


        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete ticket?"
        message={`This will permanently delete ${ticket.ticket_id}. This action cannot be undone.`}
        confirmText={deletingTicket ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        isDestructive
        onConfirm={handleConfirmDeleteTicket}
        onCancel={() => !deletingTicket && setShowDeleteConfirm(false)}
      />

      {viewingMedia && (
        <MediaPreviewDialog media={viewingMedia} onClose={() => setViewingMedia(null)} />
      )}
    </div>
  );
}
