'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notificationsApi, Notification } from '@/lib/notifications';
import { useNotifications } from '@/lib/notifications-context';

export default function NotificationsPage() {
  const { notifications, setNotifications, fetchNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Ignore
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
        );
      } catch {
        // Ignore
      }
    }
  };

  const getNotificationHref = (n: Notification) => {
    if (n.ticket_id) return `/protected/dashboard/tickets/${n.ticket_id}`;
    if (n.project_id) return `/protected/dashboard/projects/${n.project_id}`;
    return '#';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 text-sm font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="w-12 h-12 text-slate-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-slate-400">No notifications</p>
            <p className="text-slate-500 text-sm mt-1">
              Notifications auto-delete after 7 days
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={getNotificationHref(n)}
                onClick={() => handleNotificationClick(n)}
                className={`block px-4 py-3 hover:bg-slate-700/30 transition-colors ${
                  !n.read ? 'bg-sky-500/10 border-l-4 border-sky-400' : ''
                }`}
              >
                <p className="text-sm text-white">{n.message}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
