import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, FunnelIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { listCertifications, deleteCertification } from '../../api/certifications';
import type { Certification } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import CertDocViewer from '../../components/CertDocViewer';
import Modal from '../../components/Modal';
import CertificationForm from './CertificationForm';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Certifications() {
  const { isAdmin } = useAuth();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Certification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCertifications({ status: status || undefined, from: from || undefined, to: to || undefined });
      setCerts(data);
    } finally { setLoading(false); }
  }, [status, from, to]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(cert: Certification) {
    if (!confirm('Delete this certification?')) return;
    try { await deleteCertification(cert.id); toast.success('Deleted.'); load(); }
    catch { toast.error('Delete failed.'); }
  }

  function handleCertUpdated(updated: Certification) {
    setCerts((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Certifications</h1>
          <p className="text-gray-500 text-sm mt-1">{certs.length} records</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition"
          >
            <PlusIcon className="w-4 h-4" /> Add Certification
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap items-end">
        <FunnelIcon className="w-4 h-4 text-gray-400 mt-5" />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="NOTICE_DUE">Notice Due</option>
            <option value="NOTICE_SENT">Notice Sent</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expiry From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expiry To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <button onClick={() => { setStatus(''); setFrom(''); setTo(''); }}
          className="text-sm text-gray-400 hover:text-gray-600 underline">Clear</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
          </div>
        ) : certs.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No certifications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Scanner Serial', 'Location', 'Inspection Date', 'Notice Date', 'Expiry Date', 'Days Left', 'Cert Status', 'Op. Status', 'NRA Notice', 'Certificate', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certs.map((cert) => {
                  const n = cert.notifications?.[0];
                  const rowBg =
                    cert.status === 'EXPIRED' ? 'bg-red-50/40' :
                    cert.status === 'NOTICE_DUE' ? 'bg-orange-50/40' : '';
                  return (
                    <tr key={cert.id} className={`hover:bg-gray-50 transition ${rowBg}`}>
                      <td className="px-4 py-3">
                        <Link to={`/scanners/${cert.scannerId}`} className="font-mono font-semibold text-brand hover:underline">
                          {cert.scanner?.serialNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{cert.scanner?.location || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(cert.inspectionDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(cert.noticeDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{format(new Date(cert.expiryDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${(cert.daysToExpiry ?? 0) < 0 ? 'text-red-600' : (cert.daysToExpiry ?? 0) <= 30 ? 'text-orange-600' : 'text-green-600'}`}>
                          {(cert.daysToExpiry ?? 0) < 0 ? 'EXPIRED' : `${cert.daysToExpiry}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cert.certificateStatus}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={cert.status} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${n?.noticeStatus === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {n?.noticeStatus === 'SENT' ? 'Sent' : 'Not Sent'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CertDocViewer
                          cert={cert}
                          canEdit={isAdmin}
                          onUpdated={handleCertUpdated}
                        />
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditing(cert); setShowForm(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(cert)} className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Delete">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Certification' : 'Add Certification'}>
        <CertificationForm
          cert={editing}
          onSuccess={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      </Modal>
    </div>
  );
}
