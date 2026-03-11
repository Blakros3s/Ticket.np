'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { notificationsApi, Notification } from '@/lib/notifications';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.getNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, fetchNotifications, setNotifications }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
