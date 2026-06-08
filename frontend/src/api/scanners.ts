import client from './client';
import type { Scanner } from '../types';

export const listScanners = (params?: { search?: string; status?: string }) =>
  client.get<Scanner[]>('/scanners', { params }).then((r) => r.data);

export const getScanner = (id: string) =>
  client.get<Scanner>(`/scanners/${id}`).then((r) => r.data);

export const createScanner = (data: Partial<Scanner>) =>
  client.post<Scanner>('/scanners', data).then((r) => r.data);

export const updateScanner = (id: string, data: Partial<Scanner>) =>
  client.put<Scanner>(`/scanners/${id}`, data).then((r) => r.data);

export const deleteScanner = (id: string) =>
  client.delete(`/scanners/${id}`).then((r) => r.data);
