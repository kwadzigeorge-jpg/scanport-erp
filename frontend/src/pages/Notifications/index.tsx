import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { BellAlertIcon, CheckCircleIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { listNotifications, markNotificationSent, getAlerts, resolveAlert } from '../../api/notifications';
import type { Notification, AlertLog } from '../../types';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

function MarkSentForm({ notification, onSuccess, onCancel }: {
  notification: Notification;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    method: 'EMAIL',
    referenceNumber: '',
    notes: '',
    dateSent: format(new Date(), 'yyyy-MM-dd'),
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string, val: string) { setForm((f) => ({ ...f, [field]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('document', file);
      await markNotificationSent(notification.id, fd);
      toast.success('NRA notification recorded.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-blue-800">{notification.certification?.scanner?.serialNumber}</p>
        <p className="text-blue-600 text-xs mt-0.5">Recording NRA notification for this certification.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date Sent</label>
        <input type="date" value={form.dateSent} onChange={(e) => set('dateSent', e.target.value)} required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
        <select value={form.method} onChange={(e) => set('method', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
          <option value="EMAIL">Email</option>
          <option value="LETTER">Letter</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
        <input type="text" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)}
          placeholder="e.g. NRA-2026-REF-001"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Attach PDF Letter (optional)</label>
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-white file:text-sm file:cursor-pointer" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
          {loading ? 'Saving...' : 'Record Notice Sent'}
        </button>
      </div>
    </form>
  );
}

export default function Notifications() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [tab, setTab] = useState<'notifications' | 'alerts'>('notifications');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, a] = await Promise.all([listNotifications(), getAlerts()]);
      setNotifications(n);
      setAlerts(a);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id: string) {
    try { await resolveAlert(id); toast.success('Alert resolved.'); load(); }
    catch { toast.error('Failed.'); }
  }

  const pending = notifications.filter((n) => n.noticeStatus === 'NOT_SENT' &&
    n.certification?.status !== 'ACTIVE');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">NRA Notifications</h1>
        <p className="text-gray-500 text-sm mt-1">Track all Nuclear Regulatory Authority notice submissions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Notifications', val: notifications.length, cls: 'bg-gray-50' },
          { label: 'Pending (Action Required)', val: pending.length, cls: 'bg-orange-50 border border-orange-200' },
          { label: 'Active Alerts', val: alerts.length, cls: 'bg-red-50 border border-red-200' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={`${cls} rounded-xl p-4 text-center`}>
            <p className="text-2xl font-bold text-gray-800">{val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([['notifications', 'Notification Log'], ['alerts', `Active Alerts (${alerts.length})`]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" /></div>
      ) : tab === 'notifications' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Scanner Serial', 'Op. Status', 'Notice Status', 'Date Sent', 'Method', 'Reference #', 'Document', ...(isAdmin ? ['Action'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <tr key={n.id} className={`hover:bg-gray-50 ${n.noticeStatus === 'NOT_SENT' && n.certification?.status !== 'ACTIVE' ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono font-semibold text-brand">{n.certification?.scanner?.serialNumber}</td>
                    <td className="px-4 py-3">{n.certification?.status ? <StatusBadge status={n.certification.status} /> : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.noticeStatus === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {n.noticeStatus === 'SENT' ? 'Sent' : 'Not Sent'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{n.dateSent ? format(new Date(n.dateSent), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{n.method || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{n.referenceNumber || '—'}</td>
                    <td className="px-4 py-3">
                      {n.documentUrl ? (
                        <a href={n.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                          <PaperClipIcon className="w-3.5 h-3.5" /> PDF
                        </a>
                      ) : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {n.noticeStatus === 'NOT_SENT' ? (
                          <button onClick={() => setSelected(n)}
                            className="flex items-center gap-1 text-xs bg-brand text-white px-2.5 py-1.5 rounded-lg hover:bg-brand-dark transition">
                            <BellAlertIcon className="w-3.5 h-3.5" /> Mark Sent
                          </button>
                        ) : (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircleIcon className="w-3.5 h-3.5" /> Recorded
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {alerts.length === 0 ? (
            <div className="py-16 text-center text-gray-400">No active alerts.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <div key={a.id} className={`px-6 py-4 flex items-start justify-between gap-4 ${
                  a.type === 'EXPIRED' ? 'bg-red-50/30' : 'bg-orange-50/30'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        a.type === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                        a.type === 'NOTICE_DUE' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{a.type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400">{format(new Date(a.createdAt), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                    <p className="text-sm text-gray-700">{a.message}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleResolve(a.id)}
                      className="flex-shrink-0 text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition">
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Record NRA Notification">
        {selected && (
          <MarkSentForm
            notification={selected}
            onSuccess={() => { setSelected(null); load(); }}
            onCancel={() => setSelected(null)}
          />
        )}
      </Modal>
    </div>
  );
}
