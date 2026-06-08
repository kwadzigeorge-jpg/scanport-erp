import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon,
  ScissorsIcon, TruckIcon, ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { listAgentRequests, getAgentRequestStats } from '../../api/agentRequests';
import type { AgentRequest, AgentRequestStats } from '../../types';
import { format } from 'date-fns';

/* ─── Status badge ───────────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-yellow-100 text-yellow-800',
  APPROVED:    'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED:   'bg-green-100 text-green-800',
  REJECTED:    'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

/* ─── Type badge ─────────────────────────────────────────────────────────────── */
function TypeBadge({ type }: { type: string }) {
  const isSeal = type === 'SEAL_CUTTING';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      isSeal ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'
    }`}>
      {isSeal
        ? <><ScissorsIcon className="w-3 h-3" /> Seal Cutting</>
        : <><TruckIcon className="w-3 h-3" /> Gang Unstuffing</>
      }
    </span>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────────── */
export default function AgentRequests() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [stats,    setStats]    = useState<AgentRequestStats | null>(null);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);

  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [page,         setPage]         = useState(1);
  const LIMIT = 15;

  async function load() {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        listAgentRequests({ search, status: statusFilter, requestType: typeFilter, page, limit: LIMIT }),
        getAgentRequestStats(),
      ]);
      setRequests(res.requests);
      setTotal(res.total);
      setStats(s);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, statusFilter, typeFilter, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Agent Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">Seal cutting & gang unstuffing requests</p>
        </div>
        <Link
          to="/agent-requests/new"
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 shadow-sm transition"
        >
          <PlusIcon className="w-4 h-4" />
          New Request
        </Link>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total"        value={stats.total}          color="text-gray-800" />
          <StatCard label="Today"        value={stats.todayCount}     color="text-brand" />
          <StatCard label="Pending"      value={stats.pending}        color="text-yellow-600" />
          <StatCard label="Approved"     value={stats.approved}       color="text-blue-600" />
          <StatCard label="In Progress"  value={stats.inProgress}     color="text-purple-600" />
          <StatCard label="Completed"    value={stats.completed}      color="text-green-600" />
          <StatCard label="Seal Cutting" value={stats.sealCutting}    color="text-orange-600" />
          <StatCard label="Unstuffing"   value={stats.gangUnstuffing} color="text-cyan-600" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search container, request no., agent…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-brand outline-none"
          >
            <option value="">All Types</option>
            <option value="SEAL_CUTTING">Seal Cutting</option>
            <option value="GANG_UNSTUFFING">Gang Unstuffing</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-brand outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <ArchiveBoxIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No requests found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or submit a new request</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Request No.', 'Type', 'Container', 'Size', 'Seal No.', 'Agent / Agency', 'Status', 'Submitted'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => window.location.assign(`/agent-requests/${req.id}`)}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-brand text-xs whitespace-nowrap">
                    <Link to={`/agent-requests/${req.id}`} onClick={(e) => e.stopPropagation()}>
                      {req.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={req.requestType} />
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">
                    {req.containerNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {req.containerSize.replace('FT', ' ft')}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs whitespace-nowrap">
                    {req.sealNumber || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {req.requestType === 'GANG_UNSTUFFING' ? (
                      <div>
                        <p className="font-medium text-gray-800 leading-tight">{req.agentName || '—'}</p>
                        <p className="text-gray-400 text-xs">{req.agencyName || ''}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    <div>{format(new Date(req.createdAt), 'dd MMM yyyy')}</div>
                    <div className="text-gray-400">{format(new Date(req.createdAt), 'HH:mm')}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
