'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notificationsApi, Notification, getNotificationHref } from '@/lib/notifications';
import { useNotifications } from '@/lib/notifications-context';

function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
}) {
  const href = getNotificationHref(notification);
  const isClickable = Boolean(href);

  const content = (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            notification.read ? 'text-slate-400' : 'text-white group-hover:text-sky-300'
          } transition-colors`}
        >
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-xs ${notification.read ? 'text-slate-600' : 'text-slate-500'}`}>
            {new Date(notification.created_at).toLocaleString()}
          </p>
          {isClickable && (
            <span className="text-xs text-sky-400/80">
              {notification.ticket_id ? 'View ticket →' : 'View project →'}
            </span>
          )}
        </div>
      </div>
      <span
        className={`flex-shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
          notification.read
            ? 'text-slate-500 bg-slate-700/50'
            : 'text-sky-400 bg-sky-500/10'
        }`}
      >
        {notification.read ? 'Read' : 'Unread'}
      </span>
    </div>
  );

  if (!isClickable) {
    return (
      <div
        className={`px-5 py-4 ${
          notification.read ? 'bg-slate-900/20 opacity-75' : 'bg-sky-500/5 border-l-4 border-sky-400'
        }`}
      >
        {content}
      </div>
    );
  }

  const handleClick = () => {
    onNavigate(notification);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full px-5 py-4 text-left transition-colors group ${
        notification.read
          ? 'bg-slate-900/20 hover:bg-slate-700/30 opacity-90 hover:opacity-100'
          : 'bg-sky-500/5 hover:bg-sky-500/10 border-l-4 border-sky-400'
      }`}
    >
      {content}
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    setNotifications,
    fetchNotifications,
    deleteAllNotifications,
  } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'read' | 'delete' | null>(null);

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasNotifications = notifications.length > 0;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      setActionLoading('read');
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!hasNotifications) return;
    try {
      setActionLoading('delete');
      await deleteAllNotifications();
    } catch {
      // Ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotificationNavigate = async (n: Notification) => {
    if (!n.read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
        );
      } catch {
        // Continue navigation even if mark-read fails
      }
    }

    const href = getNotificationHref(n);
    if (href) {
      router.push(href);
    }
  };

  return (
    <div className="page-container">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Notifications</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl font-bold">Notifications</h1>
            <p className="page-subtitle mt-1">
              {hasNotifications
                ? `${unreadCount} unread · ${notifications.length} total`
                : 'Stay updated on tickets and projects'}
            </p>
          </div>

          {hasNotifications && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={actionLoading !== null || unreadCount === 0}
                className="px-4 py-2 text-sm font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-sky-500/20"
              >
                {actionLoading === 'read' ? 'Marking...' : 'Mark all as read'}
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors border border-red-500/20"
              >
                {actionLoading === 'delete' ? 'Deleting...' : 'Delete all'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400 mx-auto"></div>
          </div>
        ) : !hasNotifications ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-slate-300 font-medium">No notifications</p>
            <p className="text-slate-500 text-sm mt-1">
              Read notifications are automatically removed after 28 days
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onNavigate={handleNotificationNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
