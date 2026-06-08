import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { listScanners, deleteScanner } from '../../api/scanners';
import type { Scanner } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ScannerForm from './ScannerForm';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'NOTICE_DUE', label: 'Notice Due' },
  { value: 'NOTICE_SENT', label: 'Notice Sent' },
  { value: 'EXPIRED', label: 'Expired' },
];

/** Show certificateStatus badge when PENDING, otherwise operational status badge */
function CertBadge({ cert }: { cert: any }) {
  if (!cert) return <span className="text-gray-400 text-xs">No cert</span>;
  if (cert.certificateStatus === 'PENDING') {
    return <StatusBadge status="PENDING" />;
  }
  return <StatusBadge status={cert.status} />;
}

export default function Scanners() {
  const { isAdmin } = useAuth();
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Scanner | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listScanners({ search: search || undefined, status: status || undefined });
      setScanners(data);
    } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(s: Scanner) {
    if (!confirm(`Delete scanner ${s.serialNumber}? This will remove all associated certifications.`)) return;
    try {
      await deleteScanner(s.id);
      toast.success('Scanner deleted.');
      load();
    } catch { toast.error('Delete failed.'); }
  }

  function openEdit(s: Scanner) { setEditing(s); setShowForm(true); }
  function openNew() { setEditing(null); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Scanner Registry</h1>
          <p className="text-gray-500 text-sm mt-1">{scanners.length} scanners registered</p>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition"
          >
            <PlusIcon className="w-4 h-4" /> Add Scanner
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by serial number..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
          </div>
        ) : scanners.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No scanners found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {[
                    'Scanner Serial',
                    'Accelerator Serial',
                    'Manufacturer',
                    'Location',
                    'Inspection Date',
                    'Expiry Date',
                    'Days Left',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scanners.map((s) => {
                  const cert = s.latestCert;
                  const isPending = cert?.certificateStatus === 'PENDING';
                  const rowBg =
                    cert?.status === 'EXPIRED' && !isPending ? 'bg-red-50/50' :
                    cert?.status === 'NOTICE_DUE' ? 'bg-orange-50/50' :
                    isPending ? 'bg-purple-50/30' : '';

                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition ${rowBg}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-brand">{s.serialNumber}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{s.acceleratorSerial}</td>
                      <td className="px-4 py-3 text-gray-600">{s.manufacturer}</td>
                      <td className="px-4 py-3 text-gray-500">{s.location || '—'}</td>

                      {/* Inspection Date */}
                      <td className="px-4 py-3 text-gray-600">
                        {cert
                          ? format(new Date(cert.inspectionDate), 'dd MMM yyyy')
                          : '—'}
                      </td>

                      {/* Expiry Date */}
                      <td className="px-4 py-3 text-gray-700">
                        {cert
                          ? <>
                              {format(new Date(cert.expiryDate), 'dd MMM yyyy')}
                              {isPending && (
                                <span className="ml-1 text-xs text-purple-500">(provisional)</span>
                              )}
                            </>
                          : '—'}
                      </td>

                      {/* Days Left */}
                      <td className="px-4 py-3">
                        {cert ? (
                          isPending ? (
                            <span className="text-purple-600 font-medium text-xs">Awaiting cert</span>
                          ) : (
                            <span className={`font-semibold ${
                              (cert.daysToExpiry ?? 0) < 0 ? 'text-red-600' :
                              (cert.daysToExpiry ?? 0) <= 30 ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              {(cert.daysToExpiry ?? 0) < 0 ? 'Expired' : `${cert.daysToExpiry}d`}
                            </span>
                          )
                        ) : '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <CertBadge cert={cert} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            to={`/scanners/${s.id}`}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                            title="View"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Link>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEdit(s)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
                                title="Edit"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
                                title="Delete"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Edit Scanner' : 'Add Scanner'}>
        <ScannerForm scanner={editing} onSuccess={() => { closeForm(); load(); }} onCancel={closeForm} />
      </Modal>
    </div>
  );
}
