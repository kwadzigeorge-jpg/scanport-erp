import client from './client';
import type { DashboardStats, Certification } from '../types';

export const getStats = () =>
  client.get<DashboardStats>('/dashboard/stats').then((r) => r.data);

export const getExpiringList = () =>
  client.get<Certification[]>('/dashboard/expiring').then((r) => r.data);
