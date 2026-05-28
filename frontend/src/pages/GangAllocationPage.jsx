import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { gangApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Users, Plus, X, Clock, CheckCircle, AlertTriangle, BarChart3,
  ClipboardList, Zap, Activity, RefreshCw, ChevronDown, ChevronUp,
  Phone, Star, AlertCircle, FileText, Pencil, Bell, Search,
  UserCheck, PlayCircle, StopCircle, Timer, TrendingUp, MapPin,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0,10);

const GANG_STATUS = {
  available:  'bg-green-100 text-green-700',
  busy:       'bg-blue-100 text-blue-700',
  on_break:   'bg-yellow-100 text-yellow-700',
  off_duty:   'bg-gray-100 text-gray-500',
};
const GANG_STATUS_LABEL = {
  available: 'Available', busy: 'Busy', on_break: 'On Break', off_duty: 'Off Duty',
};
const ALLOC_STATUS = {
  allocated:       'bg-purple-100 text-purple-700',
  gang_dispatched: 'bg-blue-100 text-blue-700',
  in_progress:     'bg-green-100 text-green-700',
  completed:       'bg-gray-100 text-gray-500',
  cancelled:       'bg-red-100 text-red-600',
};
const ALLOC_STATUS_LABEL = {
  allocated: 'Allocated', gang_dispatched: 'Dispatched',
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
};
const PRIORITY_STYLE = { normal: 'bg-gray-100 text-gray-600', urgent: 'bg-red-100 text-red-700' };

const TABS = [
  { key: 'dashboard',   label: 'Dashboard',    icon: BarChart3 },
  { key: 'requests',    label: 'Requests',      icon: ClipboardList },
  { key: 'gangs',       label: 'Gangs',         icon: Users },
  { key: 'jobs',        label: 'Active Jobs',   icon: Activity },
  { key: 'performance', label: 'Performance',   icon: TrendingUp },
  { key: 'audit',       label: 'Audit Log',     icon: FileText },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';

function fmtDate(v) { try { return v ? format(parseISO(v.slice(0,10)), 'dd MMM yyyy') : '—'; } catch { return v || '—'; } }
function fmtTime(v) { try { return v ? format(new Date(v), 'HH:mm dd MMM') : '—'; } catch { return '—'; } }
function elapsed(v) {
  if (!v) return '—';
  const m = Math.round((Date.now() - new Date(v)) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

function KPICard({ label, value, icon: Icon, accent, sub }) {
  const bg = accent==='red' ? 'bg-red-50 border-red-200' : accent==='green' ? 'bg-green-50 border-green-200' : accent==='amber' ? 'bg-amber-50 border-amber-200' : accent==='blue' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200';
  const ic = accent==='red' ? 'bg-red-100 text-red-600' : accent==='green' ? 'bg-green-100 text-green-600' : accent==='amber' ? 'bg-amber-100 text-amber-600' : accent==='blue' ? 'bg-blue-100 text-blue-600' : 'bg-blue-100 text-blue-600';
  const tx = accent==='red' ? 'text-red-700' : accent==='green' ? 'text-green-700' : accent==='amber' ? 'text-amber-700' : accent==='blue' ? 'text-blue-700' : 'text-gray-900';
  return (
    <div className={clsx('rounded-xl border p-4 flex items-start gap-3', bg)}>
      {Icon && <div className={clsx('p-2 rounded-lg shrink-0', ic)}><Icon size={16} /></div>}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={clsx('text-2xl font-bold', tx)}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ map, value, label }) {
  return (
    <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', map[value] || 'bg-gray-100 text-gray-500')}>
      {label || value?.replace(/_/g,' ') || '—'}
    </span>
  );
}

function Modal({ title, onClose, children, wide, xlarge }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={clsx('bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col', xlarge ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Spinner() { return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>; }
function EmptyState({ message }) { return <div className="text-center py-12 text-gray-400 text-sm">{message}</div>; }

function ScoreBar({ score, max=100 }) {
  const pct = Math.min(100, Math.round((score/max)*100));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={clsx('h-1.5 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}</span>
    </div>
  );
}

// ── New Request Modal ─────────────────────────────────────────────────────────
function NewRequestModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    agent_name: '', agent_phone: '', agency: '',
    bay_number: '', container_number: '', cargo_type: '',
    priority: 'normal', notes: '',
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(gangApi.createRequest, {
    onSuccess: () => { toast.success('Request logged successfully.'); qc.invalidateQueries('gang-requests'); qc.invalidateQueries('gang-dashboard'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to log request.'),
  });

  return (
    <Modal title="Log Agent Request" onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent Name" required>
            <input className={inp} value={form.agent_name} onChange={e => set('agent_name', e.target.value)} required />
          </Field>
          <Field label="Agent Phone">
            <input className={inp} value={form.agent_phone} onChange={e => set('agent_phone', e.target.value)} />
          </Field>
          <Field label="Agency / Company" required>
            <input className={inp} value={form.agency} onChange={e => set('agency', e.target.value)} />
          </Field>
          <Field label="Priority">
            <select className={sel} value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Bay Number" required>
            <input className={inp} value={form.bay_number} onChange={e => set('bay_number', e.target.value)} required />
          </Field>
          <Field label="Container Number" required hint="Format: 4 letters + 7 digits (e.g. MSCU1234567)">
            <input className={inp} value={form.container_number} onChange={e => set('container_number', e.target.value.toUpperCase())} required placeholder="MSCU1234567" />
          </Field>
          <Field label="Cargo Type">
            <input className={inp} value={form.cargo_type} onChange={e => set('cargo_type', e.target.value)} placeholder="e.g. Electronics, Vehicles…" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : 'Log Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Allocation Engine Modal ───────────────────────────────────────────────────
function AllocateModal({ request, onClose }) {
  const qc = useQueryClient();
  const [selectedGang, setSelectedGang] = useState(null);
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [expectedStart, setExpectedStart] = useState('');
  const [expectedDuration, setExpectedDuration] = useState(60);

  const { data: gangs = [], isLoading } = useQuery('gang-recommend', () => gangApi.recommend().then(r => r.data), { refetchOnWindowFocus: false });

  const topGang = gangs[0];

  useEffect(() => {
    if (topGang && !selectedGang) setSelectedGang(topGang);
  }, [topGang]);

  useEffect(() => {
    if (selectedGang && topGang && selectedGang.id !== topGang.id) {
      setIsOverride(true);
    } else {
      setIsOverride(false);
      setOverrideReason('');
    }
  }, [selectedGang, topGang]);

  const mut = useMutation(gangApi.createAllocation, {
    onSuccess: () => {
      toast.success(`Gang ${selectedGang?.gang_code} allocated.`);
      qc.invalidateQueries('gang-requests');
      qc.invalidateQueries('gang-dashboard');
      qc.invalidateQueries('gang-allocations');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Allocation failed.'),
  });

  const handleConfirm = () => {
    if (!selectedGang) return toast.error('Please select a gang.');
    if (isOverride && !overrideReason.trim()) return toast.error('Please provide a reason for the override.');
    mut.mutate({
      request_id: request.id,
      gang_id: selectedGang.id,
      is_override: isOverride,
      override_reason: overrideReason || null,
      engine_recommended_gang: topGang?.id,
      engine_score: topGang?.allocation_score,
      expected_start: expectedStart || null,
      expected_duration_minutes: parseInt(expectedDuration),
    });
  };

  return (
    <Modal title={`Allocate Gang — ${request.request_ref}`} onClose={onClose} xlarge>
      <div className="space-y-4">
        {/* Request Summary */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-400 text-xs block">Bay</span><span className="font-semibold text-gray-800">{request.bay_number}</span></div>
            <div><span className="text-gray-400 text-xs block">Container</span><span className="font-mono font-semibold text-gray-800">{request.container_number}</span></div>
            <div><span className="text-gray-400 text-xs block">Priority</span><Badge map={PRIORITY_STYLE} value={request.priority} /></div>
            <div><span className="text-gray-400 text-xs block">Agent</span><span className="text-gray-700">{request.agent_name}</span></div>
            <div><span className="text-gray-400 text-xs block">Agency</span><span className="text-gray-700">{request.agency || '—'}</span></div>
            <div><span className="text-gray-400 text-xs block">Cargo Type</span><span className="text-gray-700">{request.cargo_type || '—'}</span></div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected Start Time">
            <input type="datetime-local" className={inp} value={expectedStart} onChange={e => setExpectedStart(e.target.value)} />
          </Field>
          <Field label="Expected Duration (minutes)">
            <input type="number" className={inp} value={expectedDuration} min={15} max={480} onChange={e => setExpectedDuration(e.target.value)} />
          </Field>
        </div>

        {/* Gang Ranking */}
        {isLoading ? <Spinner /> : (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gang Ranking (Allocation Engine)</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {gangs.map((g, i) => (
                <div key={g.id}
                  onClick={() => setSelectedGang(g)}
                  className={clsx('rounded-xl border p-3 cursor-pointer transition-all',
                    selectedGang?.id === g.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                    g.status !== 'available' && g.status !== 'on_break' && 'opacity-50'
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-600')}>
                        {i+1}
                      </span>
                      <span className="font-semibold text-gray-800">{g.gang_code}</span>
                      {i === 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">Recommended</span>}
                      <Badge map={GANG_STATUS} value={g.status} label={GANG_STATUS_LABEL[g.status]} />
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreBar score={g.allocation_score} max={100} />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {g.score_reasons?.map((r, j) => <span key={j}>{r}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Override reason */}
        {isOverride && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700">Override — reason required</p>
            <textarea className={inp} rows={2} placeholder="Why are you overriding the engine recommendation?"
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button onClick={handleConfirm} disabled={!selectedGang || mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Allocating…' : `Confirm — ${selectedGang?.gang_code || 'No gang selected'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Gang Modal ────────────────────────────────────────────────────────────────
function GangModal({ gang, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!gang;
  const [form, setForm] = useState({ gang_code: gang?.gang_code || '', specialization: gang?.specialization || '', notes: gang?.notes || '', status: gang?.status || 'available' });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(d => isEdit ? gangApi.updateGang(gang.id, d) : gangApi.createGang(d), {
    onSuccess: () => { toast.success(isEdit ? 'Gang updated.' : 'Gang registered.'); qc.invalidateQueries('gang-list'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <Modal title={isEdit ? `Edit ${gang.gang_code}` : 'Register New Gang'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <Field label="Gang Code" required hint="e.g. GANG-001">
          <input className={inp} value={form.gang_code} onChange={e => set('gang_code', e.target.value.toUpperCase())} required placeholder="GANG-001" />
        </Field>
        <Field label="Specialization">
          <input className={inp} value={form.specialization} onChange={e => set('specialization', e.target.value)} placeholder="e.g. Heavy cargo, Hazmat…" />
        </Field>
        {isEdit && (
          <Field label="Status">
            <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="available">Available</option>
              <option value="on_break">On Break</option>
              <option value="off_duty">Off Duty</option>
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : isEdit ? 'Update' : 'Register'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Member Modal ──────────────────────────────────────────────────────────────
function MemberModal({ gangId, member, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!member;
  const [form, setForm] = useState({
    role: member?.role || 'docker', full_name: member?.full_name || '',
    employee_id: member?.employee_id || '', phone: member?.phone || '',
    joined_date: member?.joined_date?.slice(0,10) || '',
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(
    d => isEdit ? gangApi.updateMember(gangId, member.id, d) : gangApi.addMember(gangId, d),
    {
      onSuccess: () => { toast.success(isEdit ? 'Member updated.' : 'Member added.'); qc.invalidateQueries(['gang-members', gangId]); qc.invalidateQueries('gang-list'); onClose(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={isEdit ? 'Edit Member' : 'Add Gang Member'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <Field label="Role" required>
          <select className={sel} value={form.role} onChange={e => set('role', e.target.value)} disabled={isEdit}>
            <option value="docker">Docker</option>
            <option value="cutter">Cutter</option>
          </select>
        </Field>
        <Field label="Full Name" required>
          <input className={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee ID" required>
            <input className={inp} value={form.employee_id} onChange={e => set('employee_id', e.target.value)} required disabled={isEdit} />
          </Field>
          <Field label="Phone">
            <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
        </div>
        <Field label="Date Joined">
          <input type="date" className={inp} value={form.joined_date} onChange={e => set('joined_date', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : isEdit ? 'Update' : 'Add Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delay Modal ───────────────────────────────────────────────────────────────
function DelayModal({ allocationId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ delay_type: 'late_arrival', delay_minutes: '', description: '' });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(d => gangApi.logDelay(allocationId, d), {
    onSuccess: () => { toast.success('Delay logged.'); qc.invalidateQueries('gang-allocations'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <Modal title="Log Delay" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <Field label="Delay Type" required>
          <select className={sel} value={form.delay_type} onChange={e => set('delay_type', e.target.value)}>
            <option value="late_arrival">Late Arrival</option>
            <option value="equipment_issue">Equipment Issue</option>
            <option value="bay_occupied">Bay Occupied</option>
            <option value="safety_concern">Safety Concern</option>
            <option value="crane_unavailable">Crane Unavailable</option>
            <option value="container_inaccessible">Container Inaccessible</option>
            <option value="documentation">Documentation</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Delay Duration (minutes)">
          <input type="number" className={inp} value={form.delay_minutes} min={1} onChange={e => set('delay_minutes', e.target.value)} />
        </Field>
        <Field label="Description" required>
          <textarea className={inp} rows={3} value={form.description} onChange={e => set('description', e.target.value)} required placeholder="Describe the delay in detail…" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : 'Log Delay'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Complete Job Modal ────────────────────────────────────────────────────────
function CompleteJobModal({ allocation, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ supervisor_comments: '', agent_rating: '', agent_feedback: '' });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const completeMut = useMutation(d => gangApi.completeJob(allocation.id, d), {
    onSuccess: () => { qc.invalidateQueries('gang-allocations'); qc.invalidateQueries('gang-dashboard'); qc.invalidateQueries('gang-list'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const feedbackMut = useMutation(d => gangApi.submitFeedback(allocation.id, d), {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    await completeMut.mutateAsync({ supervisor_comments: form.supervisor_comments });
    if (form.agent_rating) await feedbackMut.mutateAsync({ agent_rating: parseInt(form.agent_rating), agent_feedback: form.agent_feedback });
    toast.success('Job completed. Performance score updated.');
    onClose();
  };

  return (
    <Modal title="Complete Job" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-gray-700">{allocation.gang_code} — Bay {allocation.bay_number}</p>
          <p className="text-xs text-gray-500 font-mono">{allocation.container_number}</p>
          <p className="text-xs text-gray-500 mt-1">Work started: {fmtTime(allocation.work_started_at)} · Elapsed: {elapsed(allocation.work_started_at)}</p>
        </div>
        <Field label="Supervisor Comments">
          <textarea className={inp} rows={3} value={form.supervisor_comments} onChange={e => set('supervisor_comments', e.target.value)} placeholder="Any observations, outcomes, handover notes…" />
        </Field>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Agent Satisfaction Rating (optional)</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button"
                onClick={() => set('agent_rating', form.agent_rating == n ? '' : n)}
                className={clsx('w-9 h-9 rounded-full border text-sm font-semibold transition-colors',
                  form.agent_rating == n ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-gray-200 text-gray-500 hover:border-yellow-300')}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {form.agent_rating && (
          <Field label="Agent Feedback">
            <input className={inp} value={form.agent_feedback} onChange={e => set('agent_feedback', e.target.value)} placeholder="Agent's comments…" />
          </Field>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={completeMut.isLoading} className="btn-primary text-sm py-2 px-4">
            {completeMut.isLoading ? 'Completing…' : 'Mark Complete'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading, refetch } = useQuery('gang-dashboard', () => gangApi.dashboard().then(r => r.data), { refetchInterval: 30000 });
  const qc = useQueryClient();

  if (isLoading) return <Spinner />;
  const g = data?.gangs || {}; const r = data?.requests || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Gang Operations Overview — auto-refreshes every 30s</h2>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><RefreshCw size={15} /></button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Available Gangs"  value={g.available}   icon={Users}          accent="green" />
        <KPICard label="Busy Gangs"       value={g.busy}        icon={Activity}        accent="blue" />
        <KPICard label="Pending Requests" value={r.pending}     icon={ClipboardList}   accent={r.pending > 0 ? 'amber' : null} />
        <KPICard label="Active Jobs"      value={r.in_progress} icon={Timer}           accent={r.in_progress > 0 ? 'blue' : null} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="On Break"         value={g.on_break}    icon={Clock}           />
        <KPICard label="Off Duty"         value={g.off_duty}    icon={UserCheck}       />
        <KPICard label="Allocated Today"  value={r.allocated}   icon={CheckCircle}     accent="green" />
        <KPICard label="Jobs Today"       value={r.today}       icon={BarChart3}       sub="all statuses" />
      </div>

      {/* Active Jobs */}
      {data?.active_jobs?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Jobs</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Gang','Bay','Container','Priority','Status','Elapsed','Overdue?'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.active_jobs.map(j => (
                  <tr key={j.id} className={clsx('hover:bg-gray-50', j.overdue_minutes > 0 && 'bg-red-50')}>
                    <td className="px-4 py-2.5 font-semibold">{j.gang_code}</td>
                    <td className="px-4 py-2.5">{j.bay_number}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{j.container_number}</td>
                    <td className="px-4 py-2.5"><Badge map={PRIORITY_STYLE} value={j.priority} /></td>
                    <td className="px-4 py-2.5"><Badge map={ALLOC_STATUS} value={j.status} label={ALLOC_STATUS_LABEL[j.status]} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{Math.round(j.elapsed_minutes)}m</td>
                    <td className="px-4 py-2.5">
                      {j.overdue_minutes > 0
                        ? <span className="text-xs font-semibold text-red-600">+{Math.round(j.overdue_minutes)}m overdue</span>
                        : <span className="text-xs text-green-600">On time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending queue */}
      {data?.pending_queue?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Pending Allocation Queue</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref','Agent','Agency','Bay','Container','Priority','Waiting'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.pending_queue.map(r => (
                  <tr key={r.id} className={clsx('hover:bg-gray-50', r.priority === 'urgent' && 'bg-red-50/50')}>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.request_ref}</td>
                    <td className="px-4 py-2.5">{r.agent_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.agency || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold">{r.bay_number}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.container_number}</td>
                    <td className="px-4 py-2.5"><Badge map={PRIORITY_STYLE} value={r.priority} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{elapsed(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notifications */}
      {data?.notifications?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Alerts</h3>
          <div className="space-y-2">
            {data.notifications.slice(0,5).map(n => (
              <div key={n.id} className={clsx('flex items-start gap-3 px-4 py-3 rounded-xl border text-sm',
                n.type === 'job_overdue' ? 'bg-red-50 border-red-200' :
                n.type === 'pending_request' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-100')}>
                <AlertCircle size={14} className={n.type === 'job_overdue' ? 'text-red-600 shrink-0 mt-0.5' : 'text-amber-600 shrink-0 mt-0.5'} />
                <span className="text-gray-700">{n.message}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">{elapsed(n.created_at)} ago</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Requests Tab ──────────────────────────────────────────────────────────────
function RequestsTab() {
  const [showNew, setShowNew] = useState(false);
  const [allocate, setAllocate] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const flt = (k,v) => setFilters(f => ({ ...f, [k]: v }));
  const fSel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  const { data: rows = [], isLoading } = useQuery(
    ['gang-requests', filters],
    () => gangApi.listRequests({ status: filters.status||undefined, priority: filters.priority||undefined, search: filters.search||undefined }).then(r => r.data)
  );

  const qc = useQueryClient();
  const cancelMut = useMutation(gangApi.cancelRequest, {
    onSuccess: () => { toast.success('Request cancelled.'); qc.invalidateQueries('gang-requests'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            placeholder="Container, agent, bay…" value={filters.search} onChange={e => flt('search', e.target.value)} />
        </div>
        <select className={fSel} value={filters.status} onChange={e => flt('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="allocated">Allocated</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className={fSel} value={filters.priority} onChange={e => flt('priority', e.target.value)}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
        </select>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={15} /> New Request
        </button>
      </div>

      {isLoading ? <Spinner /> : !rows.length ? <EmptyState message="No requests found." /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ref','Agent / Agency','Bay','Container','Cargo','Priority','Status','Gang','Received','Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className={clsx('hover:bg-gray-50', r.priority === 'urgent' && 'bg-red-50/30')}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.request_ref}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{r.agent_name}</p>
                    <p className="text-xs text-gray-500">{r.agency || '—'}</p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{r.bay_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.container_number}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{r.cargo_type || '—'}</td>
                  <td className="px-4 py-2.5"><Badge map={PRIORITY_STYLE} value={r.priority} /></td>
                  <td className="px-4 py-2.5"><Badge map={{ pending:'bg-yellow-100 text-yellow-700', allocated:'bg-purple-100 text-purple-700', in_progress:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', cancelled:'bg-gray-100 text-gray-500' }} value={r.status} /></td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{r.gang_code || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtTime(r.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => setAllocate(r)} className="text-xs text-blue-600 font-medium hover:underline">Allocate</button>
                          <button onClick={() => cancelMut.mutate(r.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
      {allocate && <AllocateModal request={allocate} onClose={() => setAllocate(null)} />}
    </div>
  );
}

// ── Gangs Tab ─────────────────────────────────────────────────────────────────
function GangsTab() {
  const [showModal, setShowModal] = useState(false);
  const [editGang, setEditGang] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [memberModal, setMemberModal] = useState(null); // { gangId, member? }

  const { data: gangs = [], isLoading } = useQuery('gang-list', () => gangApi.listGangs().then(r => r.data));
  const { data: members = [] } = useQuery(['gang-members', expanded], () => gangApi.listMembers(expanded).then(r => r.data), { enabled: !!expanded });

  const qc = useQueryClient();
  const removeMut = useMutation(({ gid, mid }) => gangApi.removeMember(gid, mid), {
    onSuccess: (_, v) => { toast.success('Member removed.'); qc.invalidateQueries(['gang-members', v.gid]); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditGang(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={15} /> Register Gang
        </button>
      </div>

      {isLoading ? <Spinner /> : !gangs.length ? <EmptyState message="No gangs registered." /> : (
        <div className="space-y-3">
          {gangs.map(g => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-xl"
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {g.gang_code.split('-')[1] || g.gang_code[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{g.gang_code}</p>
                    <Badge map={GANG_STATUS} value={g.status} label={GANG_STATUS_LABEL[g.status]} />
                    {g.specialization && <span className="text-xs text-gray-500">{g.specialization}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {g.cutter_count} cutter · {g.docker_count}/4 dockers · {g.jobs_today} job(s) today · {g.total_jobs_completed} total
                  </p>
                </div>
                <div className="text-right mr-4">
                  <p className="text-xs text-gray-400">Performance</p>
                  <ScoreBar score={parseFloat(g.performance_score)} />
                </div>
                <button onClick={e => { e.stopPropagation(); setEditGang(g); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Pencil size={14} />
                </button>
                {expanded === g.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>

              {expanded === g.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Team Members</p>
                    <button onClick={() => setMemberModal({ gangId: g.id })} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Plus size={12} /> Add Member
                    </button>
                  </div>
                  {members.filter(m => m.is_active).length === 0 ? (
                    <p className="text-xs text-gray-400">No members yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {members.filter(m => m.is_active).map(m => (
                        <div key={m.id} className={clsx('flex items-center gap-3 rounded-lg p-2.5 border', m.role === 'cutter' ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100')}>
                          <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', m.role === 'cutter' ? 'bg-orange-500' : 'bg-blue-600')}>
                            {m.full_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.full_name}</p>
                            <p className="text-xs text-gray-500">{m.employee_id} · {m.role === 'cutter' ? '✂ Cutter' : '🪝 Docker'}</p>
                            {m.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{m.phone}</p>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setMemberModal({ gangId: g.id, member: m })} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={12} /></button>
                            <button onClick={() => removeMut.mutate({ gid: g.id, mid: m.id })} className="p-1 text-gray-400 hover:text-red-500 rounded"><X size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <GangModal gang={editGang} onClose={() => { setShowModal(false); setEditGang(null); }} />}
      {memberModal && <MemberModal gangId={memberModal.gangId} member={memberModal.member} onClose={() => { setMemberModal(null); qc.invalidateQueries(['gang-members', memberModal.gangId]); }} />}
    </div>
  );
}

// ── Active Jobs Tab ───────────────────────────────────────────────────────────
function ActiveJobsTab() {
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const flt = (k,v) => setFilters(f => ({ ...f, [k]: v }));
  const [delayModal, setDelayModal]  = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const fSel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  const { data: rows = [], isLoading } = useQuery(
    ['gang-allocations', filters],
    () => gangApi.listAllocations({ status: filters.status||undefined, from: filters.from||undefined, to: filters.to||undefined }).then(r => r.data)
  );

  const qc = useQueryClient();
  const tsMut = useMutation(({ id, ev }) => gangApi.logTimestamp(id, ev), {
    onSuccess: () => { toast.success('Timestamp logged.'); qc.invalidateQueries('gang-allocations'); qc.invalidateQueries('gang-dashboard'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" className={fSel} value={filters.from} onChange={e => flt('from', e.target.value)} />
        <input type="date" className={fSel} value={filters.to} onChange={e => flt('to', e.target.value)} />
        <select className={fSel} value={filters.status} onChange={e => flt('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="allocated">Allocated</option>
          <option value="gang_dispatched">Dispatched</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? <Spinner /> : !rows.length ? <EmptyState message="No jobs found." /> : (
        <div className="space-y-3">
          {rows.map(a => {
            const isActive = ['allocated','gang_dispatched','in_progress'].includes(a.status);
            const isOverdue = a.status === 'in_progress' && a.work_started_at &&
              (Date.now() - new Date(a.work_started_at)) > (a.expected_duration_minutes + 15) * 60000;
            return (
              <div key={a.id} className={clsx('bg-white rounded-xl border', isOverdue ? 'border-red-300' : 'border-gray-200')}>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800">{a.gang_code}</span>
                      <Badge map={ALLOC_STATUS} value={a.status} label={ALLOC_STATUS_LABEL[a.status]} />
                      <Badge map={PRIORITY_STYLE} value={a.priority} />
                      {isOverdue && <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">OVERDUE</span>}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{a.request_ref}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                    <div><span className="text-gray-400 text-xs block">Bay</span><span className="font-semibold">{a.bay_number}</span></div>
                    <div><span className="text-gray-400 text-xs block">Container</span><span className="font-mono text-xs font-semibold">{a.container_number}</span></div>
                    <div><span className="text-gray-400 text-xs block">Agent</span><span>{a.agent_name}</span></div>
                    <div><span className="text-gray-400 text-xs block">Allocated</span><span className="text-xs">{fmtTime(a.allocated_at)}</span></div>
                    <div><span className="text-gray-400 text-xs block">Arrived</span><span className="text-xs">{a.gang_arrived_at ? fmtTime(a.gang_arrived_at) : '—'}</span></div>
                    <div><span className="text-gray-400 text-xs block">Started</span><span className="text-xs">{a.work_started_at ? fmtTime(a.work_started_at) : '—'}</span></div>
                  </div>

                  {/* Timeline progress */}
                  <div className="flex items-center gap-2 mb-3">
                    {[
                      { label: 'Allocated',   done: true },
                      { label: 'Dispatched',  done: !!a.gang_arrived_at },
                      { label: 'Working',     done: !!a.work_started_at },
                      { label: 'Completed',   done: !!a.work_completed_at },
                    ].map((step, i, arr) => (
                      <React.Fragment key={step.label}>
                        <div className={clsx('flex items-center gap-1.5 text-xs font-medium', step.done ? 'text-green-600' : 'text-gray-400')}>
                          {step.done ? <CheckCircle size={13} /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                          {step.label}
                        </div>
                        {i < arr.length-1 && <div className="flex-1 h-px bg-gray-200" />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div className="flex gap-2">
                      {a.status === 'allocated' && (
                        <button onClick={() => tsMut.mutate({ id: a.id, ev: 'arrived' })}
                          className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-100">
                          <UserCheck size={13} /> Mark Arrived
                        </button>
                      )}
                      {a.status === 'gang_dispatched' && (
                        <button onClick={() => tsMut.mutate({ id: a.id, ev: 'started' })}
                          className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100">
                          <PlayCircle size={13} /> Mark Started
                        </button>
                      )}
                      {a.status === 'in_progress' && (
                        <button onClick={() => setCompleteModal(a)}
                          className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100">
                          <StopCircle size={13} /> Complete Job
                        </button>
                      )}
                      <button onClick={() => setDelayModal(a.id)}
                        className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-100">
                        <AlertTriangle size={13} /> Log Delay
                        {a.delay_count > 0 && <span className="bg-orange-600 text-white rounded-full px-1.5 text-xs">{a.delay_count}</span>}
                      </button>
                    </div>
                  )}

                  {/* Completion summary */}
                  {a.status === 'completed' && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                      <span>Completed: {fmtTime(a.work_completed_at)}</span>
                      {a.delay_count > 0 && <span className="text-orange-600">{a.delay_count} delay(s)</span>}
                      {a.agent_rating && <span className="flex items-center gap-1"><Star size={11} className="text-yellow-500" />{a.agent_rating}/5</span>}
                      {a.is_override && <span className="text-amber-600">Override used</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {delayModal && <DelayModal allocationId={delayModal} onClose={() => setDelayModal(null)} />}
      {completeModal && <CompleteJobModal allocation={completeModal} onClose={() => setCompleteModal(null)} />}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────
function PerformanceTab() {
  const [from, setFrom] = useState(new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10));
  const [to, setTo]     = useState(today);
  const fSel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  const { data, isLoading } = useQuery(
    ['gang-performance', from, to],
    () => gangApi.getPerformance({ from, to }).then(r => r.data)
  );

  const DELAY_LABELS = {
    late_arrival: 'Late Arrival', equipment_issue: 'Equipment Issue',
    bay_occupied: 'Bay Occupied', safety_concern: 'Safety Concern',
    crane_unavailable: 'Crane Unavailable', container_inaccessible: 'Container Inaccessible',
    documentation: 'Documentation', other: 'Other',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Period:</span>
        <input type="date" className={fSel} value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400">→</span>
        <input type="date" className={fSel} value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {isLoading ? <Spinner /> : !data ? null : (
        <>
          {/* Gang Rankings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Gang Rankings</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['#','Gang','Status','Jobs','Avg Duration','Avg Score','Delays','Avg Rating','On-Time Rate'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data.gang_stats || []).map((g, i) => (
                    <tr key={g.gang_code} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          i===0 ? 'bg-yellow-400 text-white' : i===1 ? 'bg-gray-300 text-white' : i===2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600')}>
                          {i+1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{g.gang_code}</td>
                      <td className="px-4 py-2.5"><Badge map={GANG_STATUS} value={g.status} label={GANG_STATUS_LABEL[g.status]} /></td>
                      <td className="px-4 py-2.5">{g.jobs_in_period || 0}</td>
                      <td className="px-4 py-2.5 text-gray-600">{g.avg_duration_min ? `${g.avg_duration_min}min` : '—'}</td>
                      <td className="px-4 py-2.5">
                        {g.avg_score ? <ScoreBar score={parseFloat(g.avg_score)} /> : '—'}
                      </td>
                      <td className="px-4 py-2.5">{g.total_delays || 0}</td>
                      <td className="px-4 py-2.5">
                        {g.avg_rating ? (
                          <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500" />{g.avg_rating}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {g.jobs_in_period > 0 ? `${Math.round((g.on_time_count/g.jobs_in_period)*100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delay Breakdown */}
          {data.delay_breakdown?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Delay Breakdown</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Delay Type','Count','Avg Duration'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.delay_breakdown.map(d => (
                      <tr key={d.delay_type} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">{DELAY_LABELS[d.delay_type] || d.delay_type}</td>
                        <td className="px-4 py-2.5 font-semibold">{d.count}</td>
                        <td className="px-4 py-2.5 text-gray-600">{d.avg_minutes ? `${d.avg_minutes}min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bay Activity */}
          {data.bay_stats?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bay Activity</h3>
              <div className="grid grid-cols-4 gap-3">
                {data.bay_stats.slice(0,8).map(b => (
                  <div key={b.bay_number} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1"><MapPin size={13} className="text-blue-500" /><span className="font-bold text-gray-800">Bay {b.bay_number}</span></div>
                    <p className="text-2xl font-bold text-blue-700">{b.job_count}</p>
                    <p className="text-xs text-gray-400">jobs</p>
                    {b.avg_duration && <p className="text-xs text-gray-500 mt-1">avg {b.avg_duration}min</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────────
function AuditTab() {
  const [from, setFrom] = useState(new Date(Date.now()-7*24*60*60*1000).toISOString().slice(0,10));
  const [to, setTo] = useState(today);
  const fSel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  const { data: rows = [], isLoading } = useQuery(
    ['gang-audit', from, to],
    () => gangApi.getAudit({ from, to }).then(r => r.data)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Period:</span>
        <input type="date" className={fSel} value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400">→</span>
        <input type="date" className={fSel} value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {isLoading ? <Spinner /> : !rows.length ? <EmptyState message="No audit records." /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Ref','Gang','Bay','Container','Priority','Allocated By','Override','Delays','Status','Allocated At','Completed At','Agent Rating'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.request_ref}</td>
                  <td className="px-4 py-2.5 font-semibold">{r.gang_code}</td>
                  <td className="px-4 py-2.5">{r.bay_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.container_number}</td>
                  <td className="px-4 py-2.5"><Badge map={PRIORITY_STYLE} value={r.priority} /></td>
                  <td className="px-4 py-2.5 text-gray-600">{r.allocated_by_name}</td>
                  <td className="px-4 py-2.5">
                    {r.is_override ? (
                      <span title={r.override_reason} className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full cursor-help">Override</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.delay_count > 0 ? (
                      <span className="text-xs text-orange-700 font-medium">{r.delay_count} ({r.delay_types})</span>
                    ) : <span className="text-xs text-gray-400">None</span>}
                  </td>
                  <td className="px-4 py-2.5"><Badge map={ALLOC_STATUS} value={r.status} label={ALLOC_STATUS_LABEL[r.status]} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtTime(r.allocated_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.work_completed_at ? fmtTime(r.work_completed_at) : '—'}</td>
                  <td className="px-4 py-2.5">
                    {r.agent_rating ? (
                      <span className="flex items-center gap-1 text-xs"><Star size={11} className="text-yellow-500" />{r.agent_rating}/5</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GangAllocationPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gang Allocation</h1>
          <p className="text-sm text-gray-500">Manage gangs, allocate jobs, track performance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'dashboard'   && <DashboardTab />}
        {tab === 'requests'    && <RequestsTab />}
        {tab === 'gangs'       && <GangsTab />}
        {tab === 'jobs'        && <ActiveJobsTab />}
        {tab === 'performance' && <PerformanceTab />}
        {tab === 'audit'       && <AuditTab />}
      </div>
    </div>
  );
}
