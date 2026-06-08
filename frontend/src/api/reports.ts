import client from './client';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadExpiryPdf() {
  const r = await client.get('/reports/expiry/pdf', { responseType: 'blob' });
  downloadBlob(r.data, 'expiry-report.pdf');
}

export async function downloadExpiryExcel() {
  const r = await client.get('/reports/expiry/excel', { responseType: 'blob' });
  downloadBlob(r.data, 'expiry-report.xlsx');
}

export async function downloadNoticePdf() {
  const r = await client.get('/reports/notices/pdf', { responseType: 'blob' });
  downloadBlob(r.data, 'notice-tracking.pdf');
}

export async function downloadNoticeExcel() {
  const r = await client.get('/reports/notices/excel', { responseType: 'blob' });
  downloadBlob(r.data, 'notice-tracking.xlsx');
}

export async function downloadNraLetter(certificationId: string) {
  const r = await client.get(`/reports/nra-letter/${certificationId}`, { responseType: 'blob' });
  downloadBlob(r.data, `nra-letter-${certificationId}.pdf`);
}
