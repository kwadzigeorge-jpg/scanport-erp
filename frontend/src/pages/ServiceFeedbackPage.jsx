import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { feedbackApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  MessageSquare, Search, Download, ChevronRight, X,
  CheckCircle2, Clock, AlertTriangle, CircleDot, MinusCircle,
  BarChart2, Users, Tag, FileText, StickyNote, ExternalLink,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:           { label: 'New',           Icon: CircleDot,    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  acknowledged:  { label: 'Acknowledged',  Icon: Clock,        bg: 'bg-amber-100',  text: 'text-amber-700'  },
  under_review:  { label: 'Under Review',  Icon: Search,       bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved:      { label: 'Resolved',      Icon: CheckCircle2, bg: 'bg-green-100',  text: 'text-green-700'  },
  closed:        { label: 'Closed',        Icon: MinusCircle,  bg: 'bg-gray-100',   text: 'text-gray-500'   },
};

const STATUS_ACTIONS = {
  new:          [{ to: 'acknowledged', label: 'Acknowledge', cls: 'bg-amber-500 hover:bg-amber-600' }, { to: 'under_review', label: 'Under Review', cls: 'bg-purple-600 hover:bg-purple-700' }],
  acknowledged: [{ to: 'under_review', label: 'Start Review', cls: 'bg-purple-600 hover:bg-purple-700' }, { to: 'resolved', label: 'Resolve', cls: 'bg-green-600 hover:bg-green-700' }],
  under_review: [{ to: 'resolved', label: 'Resolve', cls: 'bg-green-600 hover:bg-green-700' }, { to: 'acknowledged', label: 'Back to Acknowledged', cls: 'bg-amber-500 hover:bg-amber-600' }],
  resolved:     [{ to: 'closed', label: 'Close', cls: 'bg-gray-500 hover:bg-gray-600' }],
};

const PRIORITY_CFG = {
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600'   },
  normal: { label: 'Normal', cls: 'bg-blue-100 text-blue-700'   },
  high:   { label: 'High',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 font-semibold' },
};

const CATEGORY_LABELS = {
  wait_time:     'Wait Time',
  staff_conduct: 'Staff Conduct',
  facility:      'Facility',
  documentation: 'Documentation',
  communication: 'Communication',
  billing:       'Billing',
  safety:        'Safety',
  other:         'Other',
};

const TYPE_LABELS = {
  shipping_agent: 'Shipping Agent',
  importer:       'Importer',
  exporter:       'Exporter',
  truck_operator: 'Truck Operator',
  customs_broker: 'Customs Broker',
  port_authority: 'Port Authority',
  other:          'Other',
};

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  const { Icon, bg, text, label } = cfg;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap', bg, text)}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority];
  if (!cfg) return null;
  return <span className={clsx('text-xs px-2 py-0.5 rounded-full', cfg.cls)}>{cfg.label}</span>;
}

function StatCard({ label, value, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    amber:  'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    green:  'bg-green-50 text-green-700',
    gray:   'bg-gray-50 text-gray-600',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
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

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ id, onClose }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(['feedback', id], () => feedbackApi.get(id), { enabled: !!id });
  const [note, setNote] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const changeStatus = useMutation(
    ({ toStatus }) => feedbackApi.changeStatus(id, {
      status: toStatus,
      note: statusNote || undefined,
      resolution_notes: toStatus === 'resolved' ? resolution : undefined,
      assigned_to_name: assignedTo || undefined,
    }),
    {
      onSuccess: () => {
        toast.success('Status updated');
        setStatusNote('');
        setResolution('');
        qc.invalidateQueries(['feedback', id]);
        qc.invalidateQueries('feedbackList');
        qc.invalidateQueries('feedbackDashboard');
      },
      onError: () => toast.error('Failed to update status'),
    }
  );

  const addNote = useMutation(
    () => feedbackApi.addNote(id, { note }),
    {
      onSuccess: () => {
        toast.success('Note added');
        setNote('');
        qc.invalidateQueries(['feedback', id]);
      },
      onError: () => toast.error('Failed to add note'),
    }
  );

  if (isLoading) return (
    <Modal title="Loading…" onClose={onClose} wide>
      <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
    </Modal>
  );
  if (!data) return null;

  const actions = STATUS_ACTIONS[data.status] || [];
  const isResolvingAction = (toStatus) => toStatus === 'resolved';

  return (
    <Modal title={`Feedback — ${data.ref}`} onClose={onClose} wide>
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[data.category] || data.category}</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_LABELS[data.submitter_type] || data.submitter_type}</span>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900">{data.subject}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.is_anonymous ? 'Anonymous' : data.submitter_name}
            {data.company_name && ` · ${data.company_name}`}
            {data.submitter_email && ` · ${data.submitter_email}`}
            {data.submitter_phone && ` · ${data.submitter_phone}`}
          </p>
          {data.date_occurred && (
            <p className="text-xs text-gray-400 mt-0.5">Incident: {data.date_occurred}</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.description}</p>
        </div>

        {data.resolution_notes && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-xs font-semibold text-green-700 mb-1">Resolution</p>
            <p className="text-sm text-green-800">{data.resolution_notes}</p>
          </div>
        )}

        {data.assigned_to_name && (
          <p className="text-sm text-gray-600"><span className="font-medium">Assigned to:</span> {data.assigned_to_name}</p>
        )}

        {/* Activity timeline */}
        {data.activities?.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</h4>
            {data.activities.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  {a.activity_type === 'status_change' ? (
                    <p className="text-sm text-gray-700">
                      Status changed{a.old_status && ` from `}
                      {a.old_status && <StatusBadge status={a.old_status} />}
                      {' to '}
                      <StatusBadge status={a.new_status} />
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

        {/* Actions */}
        {actions.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Status</h4>
            <div>
              <input
                type="text"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="Assign to (optional)"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                rows={2}
                placeholder="Status note (optional)"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {actions.some(a => isResolvingAction(a.to)) && (
                <textarea
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  rows={2}
                  placeholder="Resolution notes (required when resolving)"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {actions.map(a => (
                  <button
                    key={a.to}
                    onClick={() => changeStatus.mutate({ toStatus: a.to })}
                    disabled={changeStatus.isLoading}
                    className={clsx('px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors', a.cls)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add note */}
        <div className="border-t pt-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Note</h4>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Internal note…"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={() => { if (note.trim()) addNote.mutate(); }}
            disabled={addNote.isLoading || !note.trim()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
          >
            Add Note
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceFeedbackPage() {
  const [tab, setTab] = useState('list');
  const [filters, setFilters] = useState({ status: '', category: '', submitter_type: '', search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const { data: dashboard } = useQuery('feedbackDashboard', feedbackApi.dashboard, { refetchInterval: 60000 });
  const { data: list, isLoading } = useQuery(
    ['feedbackList', filters, page],
    () => feedbackApi.list({ ...filters, page, limit: 25 }),
    { keepPreviousData: true }
  );

  const handleExport = async () => {
    try {
      const blob = await feedbackApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Service-Feedback.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const kpi = dashboard?.kpi || {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-600" /> Service Feedback
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Stakeholder service feedback submissions</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/feedback"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
          >
            <ExternalLink size={13} /> Public Form
          </a>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total"        value={kpi.total}        color="gray"   />
        <StatCard label="New"          value={kpi.new}          color="blue"   />
        <StatCard label="Acknowledged" value={kpi.acknowledged} color="amber"  />
        <StatCard label="Under Review" value={kpi.under_review} color="purple" />
        <StatCard label="Resolved"     value={kpi.resolved}     color="green"  />
        <StatCard label="Closed"       value={kpi.closed}       color="gray"   />
        <StatCard label="Today"        value={kpi.today}        color="blue"   />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        {[
          { key: 'list',      label: 'All Submissions', Icon: FileText  },
          { key: 'dashboard', label: 'Analytics',       Icon: BarChart2 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
            )}
          >
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {tab === 'dashboard' && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By category */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-2"><Tag size={14} /> By Category</h3>
            {(dashboard.byCategory || []).map(r => (
              <div key={r.category} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-slate-400 w-36 shrink-0">{CATEGORY_LABELS[r.category] || r.category}</span>
                <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.round((r.count / (kpi.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>

          {/* By submitter type */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-2"><Users size={14} /> By Stakeholder Type</h3>
            {(dashboard.byType || []).map(r => (
              <div key={r.submitter_type} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-slate-400 w-36 shrink-0">{TYPE_LABELS[r.submitter_type] || r.submitter_type}</span>
                <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.round((r.count / (kpi.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 w-6 text-right">{r.count}</span>
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
              <input
                type="text"
                placeholder="Search ref, name, subject…"
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
                className="pl-8 pr-3 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
              />
            </div>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none">
              <option value="">All statuses</option>
              {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none">
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filters.submitter_type} onChange={e => setFilter('submitter_type', e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none">
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none" />
            <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none" />
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
            ) : !list?.rows?.length ? (
              <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No feedback submissions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                      {['Ref', 'Submitted', 'Submitter', 'Category', 'Priority', 'Subject', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {list.rows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedId(row.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{row.ref}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {format(parseISO(row.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-slate-200 text-xs">
                            {row.is_anonymous ? 'Anonymous' : row.submitter_name}
                          </p>
                          {row.company_name && <p className="text-xs text-gray-400">{row.company_name}</p>}
                          <span className="text-xs text-gray-400">{TYPE_LABELS[row.submitter_type] || row.submitter_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {CATEGORY_LABELS[row.category] || row.category}
                        </td>
                        <td className="px-4 py-3"><PriorityBadge priority={row.priority} /></td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-gray-800 dark:text-slate-200 text-xs">{row.subject}</p>
                          {row.assigned_to_name && <p className="text-xs text-gray-400">→ {row.assigned_to_name}</p>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3 text-gray-300 dark:text-slate-600"><ChevronRight size={14} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {list && list.total > 25 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400">
              <span>{list.total} submissions · page {page} of {Math.ceil(list.total / list.limit)}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(list.total / list.limit)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedId && <DetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
