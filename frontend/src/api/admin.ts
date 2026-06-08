import client from './client';

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export const smtpTest = () =>
  client.post<{ message: string }>('/admin/smtp-test').then((r) => r.data);

export const downloadBackup = async () => {
  const r = await client.get('/admin/backup', { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scanport-backup-${new Date().toISOString().slice(0, 10)}.db`;
  a.click();
  URL.revokeObjectURL(url);
};

export const listBackups = () =>
  client.get<BackupFile[]>('/admin/backups').then((r) => r.data);
