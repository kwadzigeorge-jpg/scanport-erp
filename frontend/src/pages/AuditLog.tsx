import { useEffect, useState } from 'react';
import { ClipboardDocumentListIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { listAuditLog, type AuditEntry } from '../api/audit';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN:       'bg-gray-100 text-gray-700',
  CERT_CREATE:      'bg-green-100 text-green-700',
  CERT_UPDATE:      'bg-blue-100 text-blue-700',
  CERT_DELETE:      'bg-red-100 text-red-700',
  CERT_DOC_UPLOAD:  'bg-purple-100 text-purple-700',
  CERT_DOC_REMOVE:  'bg-orange-100 text-orange-700',
  SCANNER_CREATE:   'bg-teal-100 text-teal-700',
  SCANNER_UPDATE:   'bg-cyan-100 text-cyan-700',
  SCANNER_DELETE:   'bg-red-100 text-red-700',
  NOTICE_SENT:      'bg-indigo-100 text-indigo-700',
  ALERT_RESOLVE:    'bg-yellow-100 text-yellow-700',
  BACKUP_DOWNLOAD:  'bg-slate-100 text-slate-700',
  SMTP_TEST:        'bg-pink-100 text-pink-700',
};

const ENTITIES = ['', 'Certification', 'Scanner', 'Notification', 'User'];

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await listAuditLog(entity ? { entity } : {});
      setLogs(data);
    } catch {
      toast.error('Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [entity]);

  const filtered = search
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
        l.details.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardDocumentListIcon className="w-6 h-6 text-brand" />
          <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        </div>
        <p className="text-gray-500 text-sm">Complete record of all system actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <FunnelIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{e || 'All entities'}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Search actions, users, details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <span className="self-center text-sm text-gray-400">{filtered.length} entries</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No audit entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Entity</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{log.userEmail}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.entity}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={log.details}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
