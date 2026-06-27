import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { integrityApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldAlert, Search, Download, ChevronRight, X,
  CheckCircle2, Clock, AlertTriangle, CircleDot, MinusCircle,
  BarChart2, FileText, ExternalLink, QrCode, Printer, Lock,
  Users, MapPin, TrendingUp,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:                { label: 'New',                Icon: CircleDot,    bg: 'bg-red-100',    text: 'text-red-700'    },
  under_investigation:{ label: 'Investigating',      Icon: Search,       bg: 'bg-amber-100',  text: 'text-amber-700'  },
  substantiated:      { label: 'Substantiated',      Icon: AlertTriangle,bg: 'bg-orange-100', text: 'text-orange-700' },
  unsubstantiated:    { label: 'Unsubstantiated',    Icon: MinusCircle,  bg: 'bg-gray-100',   text: 'text-gray-500'   },
  closed:             { label: 'Closed',             Icon: CheckCircle2, bg: 'bg-green-100',  text: 'text-green-700'  },
};

const STATUS_ACTIONS = {
  new:                 [{ to: 'under_investigation', label: 'Open Investigation', cls: 'bg-amber-500 hover:bg-amber-600' }],
  under_investigation: [
    { to: 'substantiated',   label: 'Mark Substantiated',   cls: 'bg-orange-600 hover:bg-orange-700' },
    { to: 'unsubstantiated', label: 'Mark Unsubstantiated', cls: 'bg-gray-500 hover:bg-gray-600' },
  ],
  substantiated:   [{ to: 'closed', label: 'Close Case', cls: 'bg-green-600 hover:bg-green-700' }],
  unsubstantiated: [{ to: 'closed', label: 'Close Case', cls: 'bg-gray-500 hover:bg-gray-600' }],
};

const TYPE_LABELS = {
  bay_solicitation:       'Bay Solicitation',
  payment_demand:         'Payment Demand',
  bribe_accepted:         'Bribe Paid',
  preferential_treatment: 'Preferential Treatment',
  witness_only:           'Witness Only',
  other:                  'Other',
};

const TYPE_COLORS = {
  bay_solicitation:       'bg-red-100 text-red-700',
  payment_demand:         'bg-red-100 text-red-700',
  bribe_accepted:         'bg-orange-100 text-orange-700',
  preferential_treatment: 'bg-purple-100 text-purple-700',
  witness_only:           'bg-blue-100 text-blue-700',
  other:                  'bg-gray-100 text-gray-600',
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  const { Icon, bg, text, label } = cfg;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap', bg, text)}>
      <Icon size={10} />{label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TYPE_COLORS[type] || 'bg-gray-100 text-gray-500')}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    red:    'bg-red-50 text-red-700',
    amber:  'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
    green:  'bg-green-50 text-green-700',
    gray:   'bg-gray-50 text-gray-600',
    blue:   'bg-blue-50 text-blue-700',
  };
  return (
    <div className={clsx('rounded-xl p-4 flex flex-col gap-1', colors[color] || colors.gray)}>
      <p className="text-2xl font-bold">{value ?? 0}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={clsx('bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]', wide ? 'w-full max-w-3xl' : 'w-full max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({ onClose }) {
  const url = `${window.location.origin}/integrity-report`;
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=540,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Integrity Report QR</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 32px; text-align: center; background: #fff; }
        .shield { width: 56px; height: 56px; background: #dc2626; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        h1 { font-size: 20px; margin: 0 0 6px; color: #111; }
        p { color: #666; font-size: 13px; margin: 0 0 24px; max-width: 320px; }
        .qr { border: 4px solid #fee2e2; border-radius: 16px; padding: 16px; }
        .url { font-size: 11px; color: #aaa; margin-top: 16px; word-break: break-all; }
        .guarantee { margin-top: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #166534; text-align: left; }
        .guarantee li { margin: 4px 0; }
      </style>
    </head><body>
      <h1>Report Corruption Anonymously</h1>
      <p>Have you been asked to pay money for a bay? Report it here — completely anonymous, goes directly to senior management.</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}" class="qr" width="260" height="260" />
      <p class="url">${url}</p>
      <ul class="guarantee">
        <li>✓ Your identity is not recorded</li>
        <li>✓ Reports go directly to senior management</li>
        <li>✓ No consequences for genuine reports</li>
      </ul>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Report QR Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-8 flex flex-col items-center gap-4">
          <p className="text-xs text-gray-500 text-center">Post this at port gates, booths, and common areas to encourage anonymous reports</p>
          <div className="p-4 border-2 border-red-100 rounded-2xl">
            <QRCodeSVG value={url} size={200} level="M" includeMargin />
          </div>
          <p className="text-xs text-gray-400 font-mono text-center break-all">{url}</p>
          <div className="flex gap-3 w-full">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
              <ExternalLink size={13} /> Open Form
            </a>
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
              <Printer size={13} /> Print Poster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ id, onClose }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(['integrity', id], () => integrityApi.get(id), { enabled: !!id });
  const [note, setNote]               = useState('');
  const [statusNote, setStatusNote]   = useState('');
  const [assignedTo, setAssignedTo]   = useState('');
  const [investNotes, setInvestNotes] = useState('');

  const changeStatus = useMutation(
    ({ toStatus }) => integrityApi.changeStatus(id, {
      status: toStatus,
      note: statusNote || undefined,
      assigned_to: assignedTo || undefined,
      investigation_notes: investNotes || undefined,
    }),
    {
      onSuccess: () => {
        toast.success('Status updated');
        setStatusNote(''); setAssignedTo(''); setInvestNotes('');
        qc.invalidateQueries(['integrity', id]);
        qc.invalidateQueries('integrityList');
        qc.invalidateQueries('integrityDashboard');
      },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const addNote = useMutation(
    () => integrityApi.addNote(id, { note }),
    {
      onSuccess: () => { toast.success('Note added'); setNote(''); qc.invalidateQueries(['integrity', id]); },
      onError: () => toast.error('Failed to add note'),
    }
  );

  if (isLoading) return (
    <Modal title="Loading…" onClose={onClose} wide>
      <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>
    </Modal>
  );
  if (!data) return null;

  const actions = STATUS_ACTIONS[data.status] || [];

  return (
    <Modal title={`Integrity Report — ${data.ref}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Sensitivity notice */}
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-xs text-red-700">
          <Lock size={13} className="shrink-0" />
          <span>Confidential — handle according to investigation protocol. Do not share with implicated parties.</span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={data.status} />
          <TypeBadge type={data.incident_type} />
          {data.was_directly_affected && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Directly Affected</span>
          )}
          {data.reporter_contact && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Has Contact Info</span>
          )}
        </div>

        {/* Key details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['Ref', data.ref],
            ['Bay', data.bay_number || '—'],
            ['Date of Incident', data.incident_date ? format(parseISO(data.incident_date), 'dd MMM yyyy') : '—'],
            ['Amount Mentioned', data.amount_mentioned || '—'],
            ['Company', data.company_name || '—'],
            ['Reported', format(parseISO(data.created_at), 'dd MMM yyyy HH:mm')],
          ].map(([lbl, val]) => (
            <div key={lbl} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{lbl}</p>
              <p className="text-sm font-medium text-gray-800">{val}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What Happened</p>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.description}</p>
          </div>
        </div>

        {/* Staff description */}
        {data.staff_description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Staff Description</p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm text-gray-700">{data.staff_description}</p>
            </div>
          </div>
        )}

        {/* Contact */}
        {data.reporter_contact && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
            <span className="text-xs font-semibold text-blue-700 shrink-0">Follow-up contact:</span>
            <span className="text-xs text-blue-800">{data.reporter_contact}</span>
          </div>
        )}

        {/* Investigation notes */}
        {data.investigation_notes && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Investigation Notes</p>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.investigation_notes}</p>
            </div>
          </div>
        )}

        {data.assigned_to && (
          <p className="text-sm text-gray-600"><span className="font-medium">Assigned to:</span> {data.assigned_to}</p>
        )}

        {/* Activity timeline */}
        {data.activities?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity Log</p>
            {data.activities.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  {a.activity_type === 'status_change' ? (
                    <p className="text-sm text-gray-700">
                      Status changed to <StatusBadge status={a.new_status} />
                    </p>
                  ) : (
                    <p className="text-sm text-gray-700">{a.note}</p>
                  )}
                  {a.note && a.activity_type === 'status_change' && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{a.note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.created_by_name || 'System'} · {format(parseISO(a.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status actions */}
        {actions.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Investigation Status</p>
            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              placeholder="Assign to investigator (optional)"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <textarea value={investNotes} onChange={e => setInvestNotes(e.target.value)} rows={3}
              placeholder="Investigation notes (findings, evidence, actions taken…)"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2}
              placeholder="Status change note (visible in activity log)"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            <div className="flex flex-wrap gap-2">
              {actions.map(a => (
                <button key={a.to} onClick={() => changeStatus.mutate({ toStatus: a.to })}
                  disabled={changeStatus.isLoading}
                  className={clsx('px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors', a.cls)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add note */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Internal Note</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Internal note — not visible to the reporter…"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          <button onClick={() => { if (note.trim()) addNote.mutate(); }}
            disabled={addNote.isLoading || !note.trim()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40">
            Add Note
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function IntegrityManagementPage() {
  const [tab, setTab]         = useState('list');
  const [filters, setFilters] = useState({ status: '', incident_type: '', search: '', from: '', to: '' });
  const [page, setPage]       = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [showQR, setShowQR]   = useState(false);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const { data: dashboard } = useQuery('integrityDashboard', integrityApi.dashboard, { refetchInterval: 60000 });
  const { data: list, isLoading } = useQuery(
    ['integrityList', filters, page],
    () => integrityApi.list({ ...filters, page, limit: 25 }),
    { keepPreviousData: true }
  );

  const handleExport = async () => {
    try {
      const blob = await integrityApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Integrity-Reports-${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const kpi = dashboard?.kpi || {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-600" /> Integrity Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Anonymous corruption and bribery reports from port customers
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQR(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">
            <QrCode size={13} /> QR Code
          </button>
          <a href="/integrity-report" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100">
            <ExternalLink size={13} /> Public Form
          </a>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Reports"       value={kpi.total}             color="gray"   />
        <StatCard label="New"                 value={kpi.new_count}         color="red"    />
        <StatCard label="Investigating"       value={kpi.investigating}     color="amber"  />
        <StatCard label="Substantiated"       value={kpi.substantiated}     color="orange" />
        <StatCard label="Unsubstantiated"     value={kpi.unsubstantiated}   color="gray"   />
        <StatCard label="Closed"              value={kpi.closed}            color="green"  />
        <StatCard label="Directly Affected"   value={kpi.directly_affected} color="red"    />
        <StatCard label="Today"               value={kpi.today}             color="blue"   />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'list',      label: 'All Reports', Icon: FileText  },
          { key: 'analytics', label: 'Analytics',   Icon: BarChart2 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-red-600 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {tab === 'analytics' && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By incident type */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><TrendingUp size={14} /> By Incident Type</h3>
            {(dashboard.byType || []).map(r => (
              <div key={r.incident_type} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-44 shrink-0">{TYPE_LABELS[r.incident_type] || r.incident_type}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.round((r.count / (kpi.total || 1)) * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>

          {/* By bay number */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><MapPin size={14} /> Most Reported Bays</h3>
            {(dashboard.byBay || []).length === 0 ? (
              <p className="text-xs text-gray-400">No bay-specific reports yet</p>
            ) : (dashboard.byBay || []).map(r => (
              <div key={r.bay_number} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24 shrink-0">Bay {r.bay_number}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${Math.round((r.count / (dashboard.byBay[0]?.count || 1)) * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List tab */}
      {tab === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search ref, bay, description…"
                value={filters.search} onChange={e => setFilter('search', e.target.value)}
                className="pl-8 pr-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 w-52" />
            </div>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">All statuses</option>
              {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <select value={filters.incident_type} onChange={e => setFilter('incident_type', e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>
            ) : !list?.rows?.length ? (
              <div className="text-center py-16 text-gray-400">
                <ShieldAlert size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No reports found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Ref','Reported','Incident Type','Bay','Amount','Directly Affected','Status','Assigned To',''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {list.rows.map(row => (
                      <tr key={row.id}
                        className={clsx(
                          'hover:bg-gray-50 transition-colors cursor-pointer',
                          row.status === 'new' && 'bg-red-50/40'
                        )}
                        onClick={() => setSelectedId(row.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{row.ref}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {format(parseISO(row.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3"><TypeBadge type={row.incident_type} /></td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700">{row.bay_number || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{row.amount_mentioned || '—'}</td>
                        <td className="px-4 py-3">
                          {row.was_directly_affected
                            ? <span className="text-xs text-red-600 font-medium">Yes</span>
                            : <span className="text-xs text-gray-400">No</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{row.assigned_to || '—'}</td>
                        <td className="px-4 py-3 text-gray-300"><ChevronRight size={14} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {list && list.total > 25 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{list.total} reports · page {page} of {Math.ceil(list.total / list.limit)}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(list.total / list.limit)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedId && <DetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
      {showQR && <QRModal onClose={() => setShowQR(false)} />}
    </div>
  );
}
