import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { grievanceApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  FolderOpen, CircleDot, Search, CheckCircle2, AlertTriangle,
  XCircle, Clock, Download, Plus, ChevronRight, MinusCircle,
  BarChart2, Building2, X, Settings, Trash2, FileText, Link,
  ChevronDown, ChevronUp, UserCheck, Hourglass,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  harassment:                 'Harassment',
  interpersonal_conflict:     'Interpersonal Conflict',
  pay_dispute:                'Pay Dispute',
  workload_unfair_assignment: 'Workload / Unfair Assignment',
  management_conduct:         'Management Conduct',
  unsafe_working_conditions:  'Unsafe Working Conditions',
  discrimination:             'Discrimination',
  other:                      'Other',
};

const STATUS_CFG = {
  open:                { label: 'Open',               Icon: CircleDot,    bg: 'bg-amber-100',  text: 'text-amber-700',  ic: 'text-amber-500'  },
  under_investigation: { label: 'Under Investigation', Icon: Search,       bg: 'bg-blue-100',   text: 'text-blue-700',   ic: 'text-blue-500'   },
  escalated:           { label: 'Escalated',           Icon: AlertTriangle,bg: 'bg-red-100',    text: 'text-red-700',    ic: 'text-red-500'    },
  resolved:            { label: 'Resolved',            Icon: CheckCircle2, bg: 'bg-green-100',  text: 'text-green-700',  ic: 'text-green-500'  },
  withdrawn:           { label: 'Withdrawn',           Icon: XCircle,      bg: 'bg-gray-100',   text: 'text-gray-600',   ic: 'text-gray-400'   },
  closed:              { label: 'Closed',              Icon: MinusCircle,  bg: 'bg-gray-100',   text: 'text-gray-500',   ic: 'text-gray-400'   },
};

const STATUS_ACTIONS = {
  open: [
    { to: 'under_investigation', label: 'Start Investigation', cls: 'bg-blue-600 hover:bg-blue-700' },
    { to: 'escalated',           label: 'Escalate',            cls: 'bg-red-600 hover:bg-red-700'   },
    { to: 'resolved',            label: 'Resolve',             cls: 'bg-green-600 hover:bg-green-700' },
    { to: 'withdrawn',           label: 'Withdraw',            cls: 'bg-gray-500 hover:bg-gray-600'  },
  ],
  under_investigation: [
    { to: 'escalated', label: 'Escalate',     cls: 'bg-red-600 hover:bg-red-700'   },
    { to: 'resolved',  label: 'Resolve',      cls: 'bg-green-600 hover:bg-green-700' },
    { to: 'withdrawn', label: 'Withdraw',     cls: 'bg-gray-500 hover:bg-gray-600'  },
  ],
  escalated: [
    { to: 'under_investigation', label: 'Return to Investigation', cls: 'bg-blue-600 hover:bg-blue-700' },
    { to: 'resolved',            label: 'Resolve',                 cls: 'bg-green-600 hover:bg-green-700' },
  ],
};

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  const { Icon, bg, text, ic, label } = cfg;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap', bg, text)}>
      <Icon size={11} className={ic} />
      {label}
    </span>
  );
}

function DaysCell({ days, status }) {
  if (['resolved', 'withdrawn', 'closed'].includes(status)) return <span className="text-gray-300">—</span>;
  if (days == null) return <span className="text-gray-300">—</span>;
  const cls = days > 28 ? 'text-red-600 font-bold'
            : days > 21 ? 'text-orange-500 font-semibold'
            : 'text-gray-600';
  return <span className={clsx('text-sm', cls)}>{days}d</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={clsx('bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]', wide ? 'w-full max-w-2xl' : 'w-full max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const sel = inp + ' bg-white';
const ta  = inp + ' resize-none';

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('department');
  const [newLabel, setNewLabel] = useState('');

  const { data: items = [], isLoading } = useQuery(
    ['grievance-config', tab],
    () => grievanceApi.listConfig(tab),
    { keepPreviousData: true }
  );

  const addMut = useMutation(grievanceApi.createConfig, {
    onSuccess: () => {
      toast.success('Added.');
      qc.invalidateQueries(['grievance-config', tab]);
      qc.invalidateQueries(['grievance-config', 'department']);
      qc.invalidateQueries(['grievance-config', 'grievance_type']);
      setNewLabel('');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const delMut = useMutation(grievanceApi.deleteConfig, {
    onSuccess: () => {
      toast.success('Removed.');
      qc.invalidateQueries(['grievance-config', tab]);
      qc.invalidateQueries(['grievance-config', 'department']);
      qc.invalidateQueries(['grievance-config', 'grievance_type']);
    },
    onError: () => toast.error('Failed to remove.'),
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const value = tab === 'department'
      ? newLabel.trim()
      : newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    addMut.mutate({ config_type: tab, value, label: newLabel.trim() });
  };

  const TABS = [
    { key: 'department',    label: 'Departments' },
    { key: 'grievance_type', label: 'Grievance Types' },
  ];

  return (
    <Modal title="Grievance Settings" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setNewLabel(''); }}
              className={clsx('flex-1 text-sm py-1.5 rounded-md font-medium transition-colors',
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No items yet.</p>
            )}
            {items.map(item => (
              <div key={item.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                <span className="text-sm text-gray-700">{item.label}</span>
                <button onClick={() => delMut.mutate(item.id)}
                  disabled={delMut.isLoading}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Add {tab === 'department' ? 'Department' : 'Grievance Type'}
          </p>
          <div className="flex gap-2">
            <input className={clsx(inp, 'flex-1')}
              placeholder={tab === 'department' ? 'e.g. Legal' : 'e.g. Workplace Bullying'}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
            <button onClick={handleAdd} disabled={!newLabel.trim() || addMut.isLoading}
              className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 shrink-0">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── New Grievance Modal ──────────────────────────────────────────────────────
function NewGrievanceModal({ onClose }) {
  const qc = useQueryClient();

  const { data: depts = [] } = useQuery(['grievance-config', 'department'],  () => grievanceApi.listConfig('department'));
  const { data: types = [] } = useQuery(['grievance-config', 'grievance_type'], () => grievanceApi.listConfig('grievance_type'));

  const [form, setForm] = useState({
    is_anonymous: false,
    employee_name: '',
    department: '',
    grievance_type: '',
    priority: 'normal',
    date_raised: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(grievanceApi.create, {
    onSuccess: () => {
      toast.success('Grievance submitted.');
      qc.invalidateQueries('grievance-dashboard');
      qc.invalidateQueries('grievances');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to submit.'),
  });

  return (
    <Modal title="New Grievance" onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer">
          <input type="checkbox" checked={form.is_anonymous}
            onChange={e => { set('is_anonymous', e.target.checked); if (e.target.checked) set('employee_name', ''); }}
            className="rounded accent-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Submit anonymously</p>
            <p className="text-xs text-amber-600">Your name will not be recorded</p>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee Name" required={!form.is_anonymous}>
            <input className={inp} value={form.employee_name}
              onChange={e => set('employee_name', e.target.value)}
              disabled={form.is_anonymous}
              placeholder={form.is_anonymous ? 'Anonymous' : 'Full name'}
              required={!form.is_anonymous} />
          </Field>
          <Field label="Department" required>
            <select className={sel} value={form.department}
              onChange={e => set('department', e.target.value)} required>
              <option value="">— Select department —</option>
              {depts.map(d => <option key={d.id} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Grievance Type" required>
            <select className={sel} value={form.grievance_type}
              onChange={e => set('grievance_type', e.target.value)} required>
              <option value="">— Select type —</option>
              {types.map(t => <option key={t.id} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={sel} value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Date Raised">
            <input type="date" className={inp} value={form.date_raised}
              onChange={e => set('date_raised', e.target.value)} />
          </Field>
        </div>

        <Field label="Description" required>
          <textarea className={ta} rows={4} value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Describe the grievance in detail…" required />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mut.isLoading}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {mut.isLoading ? 'Submitting…' : 'Submit Grievance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Statement TYPE config ────────────────────────────────────────────────────
const STMT_TYPES = [
  { value: 'complainant', label: 'Complainant' },
  { value: 'respondent',  label: 'Respondent'  },
  { value: 'witness',     label: 'Witness'     },
  { value: 'other',       label: 'Other Party' },
];
const STMT_TYPE_COLORS = {
  complainant: 'bg-blue-100 text-blue-700',
  respondent:  'bg-red-100 text-red-700',
  witness:     'bg-purple-100 text-purple-700',
  other:       'bg-gray-100 text-gray-600',
};

// ─── Request Statement Modal ──────────────────────────────────────────────────
function RequestStatementModal({ grievanceId, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ staff_name: '', staff_designation: '', department: '', statement_type: 'witness', due_date: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation(d => grievanceApi.requestStatement(grievanceId, d), {
    onSuccess: () => {
      toast.success('Statement requested.');
      qc.invalidateQueries(['grievance-statements', grievanceId]);
      qc.invalidateQueries(['grievance', grievanceId]);
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <Modal title="Request Statement" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Staff Name" required>
          <input className={inp} value={f.staff_name} onChange={e => set('staff_name', e.target.value)} placeholder="Full name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Designation / Role">
            <input className={inp} value={f.staff_designation} onChange={e => set('staff_designation', e.target.value)} placeholder="e.g. Scanner Officer" />
          </Field>
          <Field label="Department">
            <input className={inp} value={f.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Security" />
          </Field>
          <Field label="Statement Type" required>
            <select className={sel} value={f.statement_type} onChange={e => set('statement_type', e.target.value)}>
              {STMT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" className={inp} value={f.due_date} onChange={e => set('due_date', e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => mut.mutate(f)} disabled={!f.staff_name.trim() || mut.isLoading}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {mut.isLoading ? 'Requesting…' : 'Request Statement'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Statements Section ───────────────────────────────────────────────────────
function StatementsSection({ grievanceId }) {
  const qc = useQueryClient();
  const [showRequest, setShowRequest] = useState(false);
  const [expanded, setExpanded] = useState({});

  const { data: statements = [], isLoading } = useQuery(
    ['grievance-statements', grievanceId],
    () => grievanceApi.listStatements(grievanceId)
  );

  const deleteMut = useMutation(sid => grievanceApi.deleteStatement(grievanceId, sid), {
    onSuccess: () => { toast.success('Statement request removed.'); qc.invalidateQueries(['grievance-statements', grievanceId]); },
    onError: () => toast.error('Failed to remove.'),
  });

  const copyLink = (token) => {
    const url = `${window.location.origin}/statement/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied to clipboard.')).catch(() => toast.error('Copy failed.'));
  };

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const pending   = statements.filter(s => !s.is_submitted);
  const submitted = statements.filter(s =>  s.is_submitted);

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-gray-400" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Statements
          </p>
          {statements.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
              {submitted.length}/{statements.length} received
            </span>
          )}
        </div>
        <button onClick={() => setShowRequest(true)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">
          <Plus size={12} /> Request Statement
        </button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 py-3 text-center">Loading…</div>
      ) : statements.length === 0 ? (
        <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
          No statements requested yet. Click "Request Statement" to begin collecting statements from involved parties.
        </div>
      ) : (
        <div className="space-y-2">
          {statements.map(s => (
            <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Statement header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60">
                <div className={clsx('shrink-0 p-1.5 rounded-lg', s.is_submitted ? 'bg-green-100' : 'bg-amber-100')}>
                  {s.is_submitted
                    ? <UserCheck size={13} className="text-green-600" />
                    : <Hourglass size={13} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{s.staff_name}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STMT_TYPE_COLORS[s.statement_type] || 'bg-gray-100 text-gray-600')}>
                      {STMT_TYPES.find(t => t.value === s.statement_type)?.label || s.statement_type}
                    </span>
                    {s.is_submitted
                      ? <span className="text-xs text-green-600 font-medium">✓ Submitted</span>
                      : <span className="text-xs text-amber-600 font-medium">Pending</span>}
                  </div>
                  {(s.staff_designation || s.department) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[s.staff_designation, s.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {s.due_date && !s.is_submitted && (
                    <p className={clsx('text-xs mt-0.5', new Date(s.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400')}>
                      Due {new Date(s.due_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                      {new Date(s.due_date) < new Date() && ' (overdue)'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!s.is_submitted && (
                    <button onClick={() => copyLink(s.token)}
                      title="Copy statement link"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Link size={13} />
                    </button>
                  )}
                  {s.is_submitted && (
                    <button onClick={() => toggleExpand(s.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      {expanded[s.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                  {!s.is_submitted && (
                    <button onClick={() => deleteMut.mutate(s.id)}
                      title="Remove request"
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded statement text */}
              {s.is_submitted && expanded[s.id] && (
                <div className="px-4 py-3 border-t border-gray-100 bg-white">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">
                    Statement — submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : ''}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.statement_text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showRequest && <RequestStatementModal grievanceId={grievanceId} onClose={() => setShowRequest(false)} />}
    </div>
  );
}

// ─── Case Detail Modal ────────────────────────────────────────────────────────
function CaseDetailModal({ grievance, onClose }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(['grievance', grievance.id], () => grievanceApi.get(grievance.id));
  const [actionState, setActionState] = useState(null);
  const [noteText, setNoteText] = useState('');

  const statusMut = useMutation(d => grievanceApi.changeStatus(grievance.id, d), {
    onSuccess: () => {
      toast.success('Status updated.');
      qc.invalidateQueries(['grievance', grievance.id]);
      qc.invalidateQueries('grievance-dashboard');
      qc.invalidateQueries('grievances');
      setActionState(null);
    },
    onError: e => toast.error(e.response?.data?.error || 'Update failed.'),
  });

  const noteMut = useMutation(d => grievanceApi.addNote(grievance.id, d), {
    onSuccess: () => {
      toast.success('Note added.');
      qc.invalidateQueries(['grievance', grievance.id]);
      setNoteText('');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const g = data || grievance;
  const actions = STATUS_ACTIONS[g.status] || [];

  const ACTIVITY_ICONS = {
    created: '📋', status_change: '🔄', note: '💬',
    assignment: '👤', resolution: '✅', withdrawal: '↩️',
  };

  const fmtDate = d => {
    if (!d) return '—';
    try { return format(parseISO(typeof d === 'string' ? d.slice(0, 10) : d), 'dd MMM yyyy'); }
    catch { return d; }
  };

  return (
    <Modal title={`${g.ref} — ${TYPE_LABELS[g.grievance_type] || g.grievance_type}`} onClose={onClose} wide>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Employee', value: g.is_anonymous ? <em className="text-gray-400 not-italic">Anonymous</em> : g.employee_name },
              { label: 'Department', value: g.department },
              { label: 'Status', value: <StatusBadge status={g.status} /> },
              { label: 'Date Raised', value: fmtDate(g.date_raised) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{g.description}</p>
          </div>

          {g.resolution_notes && (
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Resolution</p>
              <p className="text-sm text-gray-700 bg-green-50 rounded-lg p-3 leading-relaxed">{g.resolution_notes}</p>
            </div>
          )}
          {g.withdrawn_reason && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Withdrawal Reason</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{g.withdrawn_reason}</p>
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</p>
              {actionState ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    Change status to: <span className="font-semibold">{actionState.to.replace(/_/g, ' ')}</span>
                  </p>
                  {actionState.to === 'resolved' && (
                    <Field label="Resolution Notes" required>
                      <textarea className={ta} rows={3} value={actionState.resolution_notes || ''}
                        onChange={e => setActionState(s => ({ ...s, resolution_notes: e.target.value }))} />
                    </Field>
                  )}
                  {actionState.to === 'escalated' && (
                    <Field label="Escalation Reason" required>
                      <input className={inp} value={actionState.escalated_reason || ''}
                        onChange={e => setActionState(s => ({ ...s, escalated_reason: e.target.value }))} />
                    </Field>
                  )}
                  {actionState.to === 'withdrawn' && (
                    <Field label="Withdrawal Reason">
                      <input className={inp} value={actionState.withdrawn_reason || ''}
                        onChange={e => setActionState(s => ({ ...s, withdrawn_reason: e.target.value }))} />
                    </Field>
                  )}
                  <Field label="Note (optional)">
                    <textarea className={ta} rows={2} value={actionState.note || ''}
                      onChange={e => setActionState(s => ({ ...s, note: e.target.value }))}
                      placeholder="Add an optional note…" />
                  </Field>
                  <div className="flex gap-2">
                    <button onClick={() => statusMut.mutate({ status: actionState.to, ...actionState })}
                      disabled={statusMut.isLoading}
                      className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                      {statusMut.isLoading ? 'Saving…' : 'Confirm'}
                    </button>
                    <button onClick={() => setActionState(null)}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {actions.map(a => (
                    <button key={a.to} onClick={() => setActionState({ to: a.to })}
                      className={clsx('px-3 py-1.5 text-sm text-white rounded-lg', a.cls)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {data?.activities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
              <div className="space-y-3">
                {data.activities.map(a => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <span className="shrink-0 mt-0.5">{ACTIVITY_ICONS[a.activity_type] || '•'}</span>
                    <div className="flex-1">
                      <p className="text-gray-700">{a.note}</p>
                      {a.old_status && a.new_status && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.old_status.replace(/_/g,' ')} → {a.new_status.replace(/_/g,' ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.created_by_name || 'System'} · {a.created_at ? format(parseISO(a.created_at), 'dd MMM yyyy, HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <StatementsSection grievanceId={grievance.id} />

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Note</p>
            <div className="flex gap-2">
              <input className={clsx(inp, 'flex-1')} value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Internal case note…"
                onKeyDown={e => { if (e.key === 'Enter' && noteText.trim()) { noteMut.mutate({ note: noteText }); } }} />
              <button onClick={() => noteMut.mutate({ note: noteText })}
                disabled={!noteText.trim() || noteMut.isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GrievancePage() {
  const qc = useQueryClient();
  const [showNew, setShowNew]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [viewAll, setViewAll]       = useState(false);
  const [filters, setFilters]       = useState({ status: '', type: '', search: '' });

  const { data: typeConfig = [] } = useQuery(['grievance-config', 'grievance_type'], () => grievanceApi.listConfig('grievance_type'));
  const typeMap = Object.fromEntries(typeConfig.map(t => [t.value, t.label]));

  const { data: dashboard, isLoading: dashLoading } = useQuery(
    'grievance-dashboard', grievanceApi.dashboard, { refetchInterval: 60000 }
  );

  const { data: allData, isLoading: listLoading } = useQuery(
    ['grievances', filters],
    () => grievanceApi.list(filters),
    { enabled: viewAll }
  );

  const overdueMut = useMutation(grievanceApi.checkOverdue, {
    onSuccess: d => {
      const n = d.marked;
      toast.success(n > 0 ? `${n} case${n !== 1 ? 's' : ''} marked overdue.` : 'No new overdue cases.');
      qc.invalidateQueries('grievance-dashboard');
      qc.invalidateQueries('grievances');
    },
    onError: () => toast.error('Failed to check overdue cases.'),
  });

  const handleExport = async () => {
    try {
      const blob = await grievanceApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Grievance-Registry-${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed.'); }
  };

  const today   = new Date();
  const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
  const dayNum  = today.getDate();
  const month   = today.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
  const year    = today.getFullYear();

  const kpi   = dashboard?.kpi || {};
  const cases = viewAll ? (allData?.rows || []) : (dashboard?.recent || []);
  const maxTypeCount = Math.max(...(dashboard?.byType || []).map(t => t.count), 1);

  const KPI_CARDS = [
    { label: 'Total Cases',  value: kpi.total,        Icon: FolderOpen,    numCls: 'text-gray-900',    bCls: 'border-b-gray-400'   },
    { label: 'Open',         value: kpi.open,          Icon: CircleDot,     numCls: 'text-amber-600',   bCls: 'border-b-amber-400'  },
    { label: 'Investigating',value: kpi.investigating, Icon: Search,        numCls: 'text-blue-700',    bCls: 'border-b-blue-400'   },
    { label: 'Resolved',     value: kpi.resolved,      Icon: CheckCircle2,  numCls: 'text-green-700',   bCls: 'border-b-green-400'  },
    { label: 'Escalated',    value: kpi.escalated,     Icon: AlertTriangle, numCls: 'text-red-600',     bCls: 'border-b-red-400'    },
    { label: 'Overdue >21d', value: kpi.overdue,       Icon: Clock,         numCls: 'text-orange-600',  bCls: 'border-b-orange-400' },
  ];

  return (
    <div className="p-6 min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 tracking-widest font-medium mb-0.5">
            {dayName}, {dayNum} {month} {year}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Grievance <span className="text-red-500 italic font-serif">Registry</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => overdueMut.mutate()} disabled={overdueMut.isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
            <Clock size={14} className="text-gray-400" />
            Check Overdue
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
            <Download size={14} className="text-gray-400" />
            Export
          </button>
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            title="Manage departments & grievance types">
            <Settings size={14} className="text-gray-400" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            <Plus size={14} />
            New Grievance
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {KPI_CARDS.map(({ label, value, Icon, numCls, bCls }) => (
          <div key={label} className={clsx(
            'bg-white rounded-xl border border-gray-100 border-b-2 shadow-sm p-4', bCls
          )}>
            <Icon size={18} className="text-gray-400 mb-2" />
            <p className={clsx('text-2xl font-bold', numCls)}>
              {dashLoading ? '—' : (value ?? '—')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 280px' }}>

        {/* Cases panel */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              {viewAll ? 'All Cases' : 'Recent Cases'}
            </h2>
            {!viewAll ? (
              <button onClick={() => setViewAll(true)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                View all <ChevronRight size={12} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                  placeholder="Search ref, name…"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
                <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                  value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
                <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                  value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                  <option value="">All types</option>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => setViewAll(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5">
                  ← Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['REF','EMPLOYEE','DEPT','TYPE','STATUS','RAISED','DAYS'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-gray-400 tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(dashLoading && !viewAll) || (listLoading && viewAll) ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
                ) : cases.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No grievances found.</td></tr>
                ) : cases.map(g => (
                  <tr key={g.id} onClick={() => setSelected(g)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group">
                    <td className="px-5 py-3 text-xs text-blue-600 font-mono font-medium">{g.ref}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {g.is_anonymous
                        ? <em className="text-gray-400 font-normal not-italic text-sm">Anon</em>
                        : g.employee_name}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-sm">{g.department}</td>
                    <td className="px-5 py-3 text-gray-600 text-sm">{typeMap[g.grievance_type] || TYPE_LABELS[g.grievance_type] || g.grievance_type}</td>
                    <td className="px-5 py-3"><StatusBadge status={g.status} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {g.date_raised ? g.date_raised.slice(0, 10) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <DaysCell days={parseInt(g.days_open)} status={g.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {viewAll && allData?.total > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {allData.total} case{allData.total !== 1 ? 's' : ''} total
            </div>
          )}
        </div>

        {/* Analytics sidebar */}
        <div className="space-y-4">
          {/* By Type */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={13} className="text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">By Type</h3>
            </div>
            {(dashboard?.byType || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {dashboard.byType.map(t => (
                  <div key={t.grievance_type}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs text-gray-600 truncate pr-2 leading-tight">
                        {typeMap[t.grievance_type] || TYPE_LABELS[t.grievance_type] || t.grievance_type}
                      </span>
                      <span className="text-xs font-semibold text-gray-700 shrink-0">{t.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-800 rounded-full transition-all"
                        style={{ width: `${(t.count / maxTypeCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Department */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={13} className="text-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">By Department</h3>
            </div>
            {(dashboard?.byDept || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {dashboard.byDept.map(d => (
                  <div key={d.department} className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-xl font-bold text-gray-800">{d.count}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5 truncate">{d.department}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNew && <NewGrievanceModal onClose={() => setShowNew(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {selected && <CaseDetailModal grievance={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
