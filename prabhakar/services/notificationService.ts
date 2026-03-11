import { Notification } from '../types';

const NOTIFICATIONS_KEY = 'campus_voice_notifications';

const getNotificationsRaw = (): Notification[] => {
  const str = localStorage.getItem(NOTIFICATIONS_KEY);
  return str ? JSON.parse(str) : [];
};

const saveNotifications = (notifications: Notification[]) => {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
};

export const notificationService = {
  getUserNotifications(userId: string): Notification[] {
    const all = getNotificationsRaw();
    return all.filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },

  getUnreadCount(userId: string): number {
    return this.getUserNotifications(userId).filter(n => !n.read).length;
  },

  createNotification(userId: string, message: string, type: Notification['type'], relatedGrievanceId?: string) {
    const all = getNotificationsRaw();
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      userId,
      message,
      type,
      relatedGrievanceId,
      read: false,
      createdAt: Date.now(),
    };
    all.push(newNotification);
    saveNotifications(all);
    return newNotification;
  },

  markAsRead(notificationId: string) {
    const all = getNotificationsRaw();
    const updated = all.map(n => n.id === notificationId ? { ...n, read: true } : n);
    saveNotifications(updated);
  },

  markAllAsRead(userId: string) {
    const all = getNotificationsRaw();
    const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
    saveNotifications(updated);
  }
};