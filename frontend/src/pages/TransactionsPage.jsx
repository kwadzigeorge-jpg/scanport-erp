import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { containersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/Containers/StatusBadge';
import ChitPrintView from '../components/Containers/ChitPrintView';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Search, Eye, Printer, Edit, ChevronLeft, ChevronRight,
  Clock, CheckCircle, Circle, Loader
} from 'lucide-react';

const ALL_STATUSES = [
  'ARRIVED_AT_BOOTH',
  'PENDING_BAY_ASSIGNMENT',
  'BAY_ASSIGNED',
  'ARRIVED_AT_BAY',
  'UNDER_EXAMINATION',
  'EXAMINATION_COMPLETED',
  'EXITED',
  'CANCELLED',
];

const OVERRIDE_STATUSES = ALL_STATUSES;

export default function TransactionsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    status: '', containerNumber: '', waybillNumber: '', truckNumber: '', page: 1,
  });
  const [viewId, setViewId] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [printTxn, setPrintTxn] = useState(null);

  const { data, isLoading } = useQuery(
    ['transactions', filters],
    () => containersApi.list({
      status:          filters.status || undefined,
      containerNumber: filters.containerNumber || undefined,
      waybillNumber:   filters.waybillNumber   || undefined,
      truckNumber:     filters.truckNumber      || undefined,
      page:   filters.page,
      limit:  20,
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const overrideMutation = useMutation(
    ({ id, data }) => containersApi.override(id, data),
    {
      onSuccess: () => {
        toast.success('Transaction updated.');
        qc.invalidateQueries('transactions');
        setEditTxn(null);
      },
      onError: err => toast.error(err.response?.data?.error || 'Update failed.'),
    }
  );

  const clearFilters = () => setFilters({ status: '', containerNumber: '', waybillNumber: '', truckNumber: '', page: 1 });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <span className="text-sm text-gray-500">{data?.total ?? 0} records</span>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-36">
          <label className="label">Container No.</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 uppercase font-mono"
              placeholder="HLBU2304692"
              value={filters.containerNumber}
              onChange={e => setFilters(f => ({ ...f, containerNumber: e.target.value.toUpperCase(), page: 1 }))}
              maxLength={11}
            />
          </div>
        </div>
        <div className="flex-1 min-w-36">
          <label className="label">Waybill No.</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 uppercase font-mono"
              placeholder="WB-2024-001234"
              value={filters.waybillNumber}
              onChange={e => setFilters(f => ({ ...f, waybillNumber: e.target.value.toUpperCase(), page: 1 }))}
            />
          </div>
        </div>
        <div className="flex-1 min-w-28">
          <label className="label">Truck No.</label>
          <input
            className="input uppercase font-mono"
            placeholder="GR-1234-24"
            value={filters.truckNumber}
            onChange={e => setFilters(f => ({ ...f, truckNumber: e.target.value.toUpperCase(), page: 1 }))}
          />
        </div>
        <div className="min-w-44">
          <label className="label">Status</label>
          <select
            className="input"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <button onClick={clearFilters} className="btn-secondary">Clear</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Txn ID', 'Waybill', 'Container', 'Truck', 'Agent', 'Area / Bay', 'Status', 'Time In', 'Dwell', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : !data?.transactions?.length ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">No transactions found</td></tr>
              ) : data.transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{t.transaction_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                    {t.waybill_number || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">{t.container_number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{t.truck_number || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 whitespace-nowrap">{t.agent_name}</p>
                    <p className="text-xs text-gray-400">{t.agent_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {t.area_name
                      ? <><span>{t.area_name}</span><br /><span className="text-xs text-gray-400">{t.bay_code || '—'}</span></>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                    {t.arrival_time || t.time_in
                      ? format(new Date(t.arrival_time || t.time_in), 'dd MMM HH:mm')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {t.dwell_minutes != null ? `${t.dwell_minutes}m` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewId(t.id)} title="View Timeline" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Eye size={15} />
                      </button>
                      {t.qr_code_token && (
                        <button onClick={() => setPrintTxn(t)} title="Print Chit" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                          <Printer size={15} />
                        </button>
                      )}
                      {hasPermission('container:override') && (
                        <button onClick={() => setEditTxn(t)} title="Override" className="p-1.5 text-gray-400 hover:text-orange-600 rounded">
                          <Edit size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(filters.page - 1) * 20 + 1}–{Math.min(filters.page * 20, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="btn-secondary px-2 py-1"
              ><ChevronLeft size={16} /></button>
              <button
                disabled={filters.page * 20 >= data.total}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="btn-secondary px-2 py-1"
              ><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / timeline modal */}
      {viewId && <TxnDetailModal id={viewId} onClose={() => setViewId(null)} />}

      {/* Print chit */}
      {printTxn && <ChitPrintView transaction={printTxn} onClose={() => setPrintTxn(null)} />}

      {/* Override modal */}
      {editTxn && (
        <OverrideModal
          txn={editTxn}
          onClose={() => setEditTxn(null)}
          onSave={(d) => overrideMutation.mutate({ id: editTxn.id, data: d })}
          loading={overrideMutation.isLoading}
        />
      )}
    </div>
  );
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'ARRIVED_AT_BOOTH',       label: 'Arrived at Booth',      tsField: 'arrival_time' },
  { key: 'PENDING_BAY_ASSIGNMENT', label: 'Pending Bay Assignment', tsField: null },
  { key: 'BAY_ASSIGNED',           label: 'Bay Assigned',           tsField: 'bay_assigned_time' },
  { key: 'ARRIVED_AT_BAY',         label: 'Arrived at Bay',         tsField: 'bay_entry_time' },
  { key: 'UNDER_EXAMINATION',      label: 'Examination Started',    tsField: 'examination_start_time' },
  { key: 'EXAMINATION_COMPLETED',  label: 'Examination Completed',  tsField: 'examination_end_time' },
  { key: 'EXITED',                 label: 'Exited',                 tsField: 'time_out' },
];

const STATUS_ORDER = TIMELINE_STEPS.map(s => s.key);

function Timeline({ txn }) {
  const currentIdx = STATUS_ORDER.indexOf(txn.status);
  const timeline   = Array.isArray(txn.timeline) ? txn.timeline : [];

  return (
    <div className="space-y-1">
      {TIMELINE_STEPS.map((step, idx) => {
        const tsFromField  = step.tsField ? txn[step.tsField] : null;
        const tsFromLog    = timeline.find(e => e.status === step.key)?.timestamp;
        const ts           = tsFromLog || tsFromField;
        const done         = currentIdx >= idx || txn.status === 'EXITED';
        const active       = txn.status === step.key;
        const cancelled    = txn.status === 'CANCELLED';

        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex flex-col items-center shrink-0">
              <div className={
                active ? 'w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center' :
                done   ? 'w-5 h-5 rounded-full bg-green-500 flex items-center justify-center' :
                cancelled ? 'w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center' :
                           'w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center'
              }>
                {active ? <Loader size={11} className="text-white animate-spin" /> :
                 done   ? <CheckCircle size={11} className="text-white" /> :
                          <Circle size={11} className="text-gray-300" />}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 h-6 mt-0.5 ${done && currentIdx > idx ? 'bg-green-300' : 'bg-gray-100'}`} />
              )}
            </div>
            {/* Label + ts */}
            <div className="pb-1">
              <p className={`text-sm font-medium ${active ? 'text-blue-700' : done ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.label}
              </p>
              {ts && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> {format(new Date(ts), 'dd MMM yyyy HH:mm:ss')}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {txn.status === 'CANCELLED' && (
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">✕</span>
          </div>
          <p className="text-sm font-medium text-gray-500">Cancelled</p>
        </div>
      )}
    </div>
  );
}

// ─── Detail modal (fetches full txn with timeline) ────────────────────────────
function TxnDetailModal({ id, onClose }) {
  const { data, isLoading } = useQuery(
    ['transaction', id],
    () => containersApi.get(id).then(r => r.data),
    { staleTime: 10000 }
  );
  const txn = data?.transaction || data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900">Transaction Details &amp; Timeline</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !txn ? (
            <p className="text-center text-gray-400 py-8">Transaction not found.</p>
          ) : (
            <div className="space-y-5">
              {/* Core fields */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Txn ID',     txn.transaction_id],
                  ['Waybill',    txn.waybill_number || '—'],
                  ['Container',  txn.container_number],
                  ['Truck',      txn.truck_number || '—'],
                  ['Agent',      txn.agent_name],
                  ['Phone',      txn.agent_phone || '—'],
                  ['Area',       txn.area_name || '—'],
                  ['Bay',        txn.bay_code || '—'],
                  ['Dwell',      txn.dwell_minutes != null ? `${txn.dwell_minutes} min` : '—'],
                ].map(([label, val]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
                    <span className="font-medium text-gray-900 font-mono text-xs">{val}</span>
                  </div>
                ))}
                <div className="flex flex-col col-span-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</span>
                  <StatusBadge status={txn.status} />
                </div>
                {txn.examination_findings && (
                  <div className="col-span-2 flex flex-col">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Findings</span>
                    <span className="text-sm text-gray-800 mt-0.5">{txn.examination_findings}</span>
                  </div>
                )}
                {txn.notes && (
                  <div className="col-span-2 flex flex-col">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Notes</span>
                    <span className="text-sm text-gray-800 mt-0.5">{txn.notes}</span>
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Workflow Timeline</p>
                <Timeline txn={txn} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Override modal ───────────────────────────────────────────────────────────
function OverrideModal({ txn, onClose, onSave, loading }) {
  const [form, setForm] = useState({ status: txn.status, notes: txn.notes || '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-orange-700">Override Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-600 space-y-0.5">
            <p>Txn: <span className="font-mono font-semibold">{txn.transaction_id}</span></p>
            {txn.waybill_number && <p>Waybill: <span className="font-mono font-semibold">{txn.waybill_number}</span></p>}
          </div>
          <div>
            <label className="label">New Status</label>
            <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {OVERRIDE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Supervisor Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Reason for override…"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => onSave(form)}
              disabled={loading}
              className="btn-primary flex-1 justify-center bg-orange-500 hover:bg-orange-600"
            >
              {loading
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Save Override'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
