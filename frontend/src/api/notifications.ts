import client from './client';
import type { Notification, AlertLog } from '../types';

export const listNotifications = (certificationId?: string) =>
  client.get<Notification[]>('/notifications', { params: { certificationId } }).then((r) => r.data);

export const getAlerts = () =>
  client.get<AlertLog[]>('/notifications/alerts').then((r) => r.data);

export const markNotificationSent = (id: string, formData: FormData) =>
  client.patch<Notification>(`/notifications/${id}/mark-sent`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const updateNotification = (id: string, formData: FormData) =>
  client.put<Notification>(`/notifications/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const resolveAlert = (id: string) =>
  client.patch(`/notifications/alerts/${id}/resolve`).then((r) => r.data);
