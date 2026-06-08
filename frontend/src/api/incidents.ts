import client from './client';
import type {
  Ticket, TicketListResponse, IncidentMeta,
  IncidentStats, Location,
} from '../types';

// ─── Meta / Locations ────────────────────────────────────────────────────────

export const getMeta = () =>
  client.get<IncidentMeta>('/incidents/meta').then((r) => r.data);

export const getLocations = () =>
  client.get<Location[]>('/incidents/locations').then((r) => r.data);

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getIncidentStats = () =>
  client.get<IncidentStats>('/incidents/stats').then((r) => r.data);

// ─── Tickets ─────────────────────────────────────────────────────────────────

export interface TicketFilters {
  status?: string;
  severity?: string;
  locationId?: string;
  issueType?: string;
  equipmentType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const listTickets = (filters: TicketFilters = {}) =>
  client.get<TicketListResponse>('/incidents', { params: filters }).then((r) => r.data);

export const getTicket = (id: string) =>
  client.get<Ticket>(`/incidents/${id}`).then((r) => r.data);

export interface CreateTicketPayload {
  title: string;
  description: string;
  locationId: string;
  equipmentType: string;
  issueType: string;
  severity: string;
  assignedTo?: string;
  assignedToId?: string;
}

export const createTicket = (data: CreateTicketPayload) =>
  client.post<Ticket>('/incidents', data).then((r) => r.data);

export interface UpdateTicketPayload {
  status?: string;
  assignedTo?: string;
  assignedToId?: string;
  resolutionNotes?: string;
  escalationLevel?: number;
  notes?: string;
  severity?: string;
  title?: string;
  description?: string;
}

export const updateTicket = (id: string, data: UpdateTicketPayload) =>
  client.patch<Ticket>(`/incidents/${id}`, data).then((r) => r.data);

export const addComment = (id: string, notes: string) =>
  client.post(`/incidents/${id}/comments`, { notes }).then((r) => r.data);

export const uploadAttachment = (id: string, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return client.post(`/incidents/${id}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  severity?: string;
  status?: string;
  issueType?: string;
}

export async function downloadIncidentPdf(filters: ReportFilters = {}) {
  const res = await client.get('/incidents/reports/pdf', {
    params:       filters,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `incident-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadIncidentExcel(filters: ReportFilters = {}) {
  const res = await client.get('/incidents/reports/excel', {
    params:       filters,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(
    new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `incident-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
