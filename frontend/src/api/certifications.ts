import client from './client';
import type { Certification } from '../types';

export const listCertifications = (params?: { status?: string; from?: string; to?: string }) =>
  client.get<Certification[]>('/certifications', { params }).then((r) => r.data);

export const getCertification = (id: string) =>
  client.get<Certification>(`/certifications/${id}`).then((r) => r.data);

export const createCertification = (data: {
  scannerId: string;
  inspectionDate: string;
  expiryDate?: string;          // omit to auto-set as inspectionDate + 1 year
  certificateStatus?: string;
}) => client.post<Certification>('/certifications', data).then((r) => r.data);

export const updateCertification = (id: string, data: Partial<Certification>) =>
  client.put<Certification>(`/certifications/${id}`, data).then((r) => r.data);

export const deleteCertification = (id: string) =>
  client.delete(`/certifications/${id}`).then((r) => r.data);

export const uploadCertDocument = (id: string, file: File) => {
  const fd = new FormData();
  fd.append('document', file);
  return client.patch<Certification>(`/certifications/${id}/document`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const removeCertDocument = (id: string) =>
  client.delete(`/certifications/${id}/document`).then((r) => r.data);
