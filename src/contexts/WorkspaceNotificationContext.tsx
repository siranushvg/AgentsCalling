import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationUrgency = 'normal' | 'urgent' | 'due' | 'overdue' | 'info';

export interface WorkspaceNotification {
  id: string;
  type: 'callback_reminder' | 'callback_due' | 'callback_overdue' | 'callback_completed' | 'system';
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  urgency: NotificationUrgency;
  relatedLeadId?: string;
  relatedCallbackId?: string;
}

interface WorkspaceNotificationContextType {
  notifications: WorkspaceNotification[];
  unreadCount: number;
  addNotification: (n: Omit<WorkspaceNotification, 'id' | 'createdAt' | 'readAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const Ctx = createContext<WorkspaceNotificationContextType | null>(null);

export function useWorkspaceNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspaceNotifications must be used within provider');
  return ctx;
}

export function WorkspaceNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);

  const addNotification = useCallback((n: Omit<WorkspaceNotification, 'id' | 'createdAt' | 'readAt'>) => {
    setNotifications(prev => [{
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
      readAt: null,
    }, ...prev]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date() } : n));
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date();
    setNotifications(prev => prev.map(n => n.readAt ? n : { ...n, readAt: now }));
  }, []);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <Ctx.Provider value={{ notifications, unreadCount, addNotification, markRead, markAllRead }}>
      {children}
    </Ctx.Provider>
  );
}
