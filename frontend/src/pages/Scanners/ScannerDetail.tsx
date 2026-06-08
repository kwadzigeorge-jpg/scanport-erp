import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { getScanner } from '../../api/scanners';
import type { Scanner, Certification } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import CertDocViewer from '../../components/CertDocViewer';
import Modal from '../../components/Modal';
import CertificationForm from '../Certifications/CertificationForm';
import { useAuth } from '../../contexts/AuthContext';

export default function ScannerDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCertForm, setShowCertForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getScanner(id!);
      setScanner(s);
      setCerts((s.certifications ?? []) as Certification[]);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Local update when a cert document is attached/removed without full reload
  function handleCertUpdated(updated: Certification) {
    setCerts((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand border-t-transparent" />
    </div>
  );
  if (!scanner) return <div className="text-gray-400 py-20 text-center">Scanner not found.</div>;

  const latestCert = certs[0];

  return (
    <div>
      <Link to="/scanners" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand mb-6">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Scanners
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Info card */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 font-mono">{scanner.serialNumber}</h1>
              <p className="text-gray-500 text-sm">{scanner.type} · {scanner.manufacturer}</p>
            </div>
            {latestCert && (
              latestCert.certificateStatus === 'PENDING'
                ? <StatusBadge status="PENDING" />
                : <StatusBadge status={latestCert.status} />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Accelerator Serial', scanner.acceleratorSerial],
              ['Location', scanner.location || '—'],
              ['Registered', format(new Date(scanner.createdAt), 'dd MMM yyyy')],
              ['Total Certifications', String(certs.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-400 text-xs mb-0.5">{k}</dt>
                <dd className="font-medium text-gray-700">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Current cert card */}
        {latestCert && (
          <div className={`rounded-2xl p-5 shadow-sm border ${
            latestCert.status === 'EXPIRED' && latestCert.certificateStatus !== 'PENDING'
              ? 'bg-red-50 border-red-200'
              : latestCert.status === 'NOTICE_DUE'
              ? 'bg-orange-50 border-orange-200'
              : latestCert.certificateStatus === 'PENDING'
              ? 'bg-purple-50 border-purple-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Current Certification</p>
            <dl className="space-y-2 text-sm">
              {[
                ['Inspection', format(new Date(latestCert.inspectionDate), 'dd MMM yyyy')],
                ['Expiry', format(new Date(latestCert.expiryDate), 'dd MMM yyyy') + (latestCert.certificateStatus === 'PENDING' ? ' (provisional)' : '')],
                ['Notice Date', format(new Date(latestCert.noticeDate), 'dd MMM yyyy')],
                ['Days to Expiry', latestCert.certificateStatus === 'PENDING' ? 'Awaiting cert' : `${latestCert.daysToExpiry ?? '—'} days`],
                ['Cert Status', latestCert.certificateStatus],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-semibold text-gray-800 text-right">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Certificate document quick-view */}
            {(latestCert.documentUrl || isAdmin) && (
              <div className="mt-4 pt-4 border-t border-black/10">
                <p className="text-xs text-gray-400 mb-2 uppercase font-semibold">Certificate Document</p>
                <CertDocViewer
                  cert={latestCert}
                  canEdit={isAdmin}
                  onUpdated={handleCertUpdated}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Certifications history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Certification History</h2>
          {isAdmin && (
            <button
              onClick={() => setShowCertForm(true)}
              className="flex items-center gap-1.5 text-sm bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add Certification
            </button>
          )}
        </div>

        {certs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No certifications yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Inspection Date', 'Expiry Date', 'Notice Date', 'Cert Status', 'Op. Status', 'NRA Notice', 'Certificate'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certs.map((cert) => {
                  const n = cert.notifications?.[0];
                  const isPending = cert.certificateStatus === 'PENDING';
                  return (
                    <tr key={cert.id} className={`hover:bg-gray-50 ${isPending ? 'bg-purple-50/30' : ''}`}>
                      <td className="px-4 py-3">{format(new Date(cert.inspectionDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        {format(new Date(cert.expiryDate), 'dd MMM yyyy')}
                        {isPending && <span className="ml-1 text-xs text-purple-400">(prov.)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{format(new Date(cert.noticeDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPending ? 'bg-purple-100 text-purple-700' :
                          cert.certificateStatus === 'EXPIRED' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>{cert.certificateStatus}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? <StatusBadge status="PENDING" /> : <StatusBadge status={cert.status} />}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          n?.noticeStatus === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {n?.noticeStatus === 'SENT'
                            ? `Sent ${n.dateSent ? format(new Date(n.dateSent), 'dd/MM/yy') : ''}`
                            : 'Not Sent'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <CertDocViewer
                          cert={cert}
                          canEdit={isAdmin}
                          onUpdated={handleCertUpdated}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showCertForm} onClose={() => setShowCertForm(false)} title="Add Certification">
        <CertificationForm
          scannerId={scanner.id}
          onSuccess={() => { setShowCertForm(false); load(); }}
          onCancel={() => setShowCertForm(false)}
        />
      </Modal>
    </div>
  );
}
