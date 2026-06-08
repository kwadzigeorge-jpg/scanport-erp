import client from './client';

export interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export const listAuditLog = (params?: { entity?: string; action?: string }) =>
  client.get<AuditEntry[]>('/audit', { params }).then((r) => r.data);
