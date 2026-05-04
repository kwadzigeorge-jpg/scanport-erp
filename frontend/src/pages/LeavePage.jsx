import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  CalendarDays, Users, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Trash2, UserPlus, ShieldOff,
  RefreshCw, Download,
} from 'lucide-react';

const LEAVE_TYPES = [
  'Annual Leave', 'Sick Leave', 'Compassionate Leave',
  'Maternity Leave', 'Paternity Leave',
];
const GIFT_TYPES = ['Maternity Leave', 'Paternity Leave'];
const MATERNITY_DAYS = 65;
const PATERNITY_DAYS = 9;

// ─── Working-day calculator (client side) ────────────────────────────────────
function calcWorkingDays(start, end, holidays) {
  if (!start || !end) return 0;
  const holidaySet = new Set((holidays || []).map(h => h.date?.slice(0, 10)));
  let count = 0;
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    const dow = cur.getDay();
    const ds  = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function addWorkingDays(start, days, holidays) {
  const holidaySet = new Set((holidays || []).map(h => h.date?.slice(0, 10)));
  const cur = new Date(start + 'T00:00:00');
  let added = 0;
  while (added < days) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    const ds  = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) added++;
  }
  return cur.toISOString().slice(0, 10);
}

// ─── Small shared components ─────────────────────────────────────────────────
const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'submit',     label: '+ Submit' },
  { key: 'approvals',  label: 'Approvals', adminOnly: true },
  { key: 'records',    label: 'Records' },
  { key: 'balances',   label: 'Balances' },
  { key: 'roster',     label: 'Roster', adminOnly: true },
  { key: 'holidays',   label: 'Holidays', adminOnly: true },
];

function Badge({ children, color = 'gray' }) {
  const cls = {
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
  }[color] || 'bg-gray-100 text-gray-600';
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function statusBadge(s) {
  if (s === 'Approved') return <Badge color="green">Approved</Badge>;
  if (s === 'Rejected') return <Badge color="red">Rejected</Badge>;
  return <Badge color="amber">Pending</Badge>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading } = useQuery('leave-overview', () => leaveApi.overview().then(r => r.data), { refetchInterval: 60000 });

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  const { onLeave = [], pendingCount = 0, lowBalance = [] } = data || {};

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<CalendarDays size={20} className="text-blue-500" />}
          label="On Leave Today" value={onLeave.length} color="blue" />
        <StatCard icon={<Clock size={20} className="text-amber-500" />}
          label="Pending Approvals" value={pendingCount} color="amber" />
        <StatCard icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Low Balances (≤5 days)" value={lowBalance.length} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Staff On Leave Today</h3>
          {!onLeave.length
            ? <p className="text-sm text-gray-400">No one on leave today.</p>
            : <div className="space-y-2">
                {onLeave.map(r => (
                  <div key={r.id} className="flex justify-between items-center py-1.5 border-b last:border-0 border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.team} · Returns {fmtDate(r.end_date)}</p>
                    </div>
                    <Badge color="blue">{r.leave_type.replace(' Leave', '')}</Badge>
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Low Leave Balances</h3>
          {!lowBalance.length
            ? <p className="text-sm text-gray-400">All balances are healthy.</p>
            : <div className="space-y-2">
                {lowBalance.map(s => {
                  const remaining = s.annual_entitlement - s.used;
                  const pct = Math.max(0, (remaining / s.annual_entitlement) * 100);
                  return (
                    <div key={s.id} className="py-1.5 border-b last:border-0 border-gray-100">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className={`font-semibold ${remaining <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {remaining} days left
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{s.team}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const bg = { blue: 'bg-blue-50', amber: 'bg-amber-50', red: 'bg-red-50' }[color] || 'bg-gray-50';
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-4`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Submit tab ───────────────────────────────────────────────────────────────
function SubmitTab() {
  const qc = useQueryClient();
  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const { data: holidays = [] } = useQuery('lms-holidays', () => leaveApi.holidays().then(r => r.data));

  const today = new Date().toISOString().slice(0, 10);
  const year  = new Date().getFullYear();

  const [form, setForm] = useState({
    staffId: '', leaveType: 'Annual Leave', startDate: today, endDate: today, notes: '',
  });
  const [preview, setPreview] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isGift = GIFT_TYPES.includes(form.leaveType);

  function handleTypeChange(lt) {
    let update = { leaveType: lt };
    if (lt === 'Maternity Leave' && form.startDate) {
      update.endDate = addWorkingDays(form.startDate, MATERNITY_DAYS, holidays);
    } else if (lt === 'Paternity Leave' && form.startDate) {
      update.endDate = addWorkingDays(form.startDate, PATERNITY_DAYS, holidays);
    }
    setForm(f => ({ ...f, ...update }));
    recalc({ ...form, ...update });
  }

  function handleStartChange(sd) {
    let update = { startDate: sd };
    if (form.leaveType === 'Maternity Leave') update.endDate = addWorkingDays(sd, MATERNITY_DAYS, holidays);
    else if (form.leaveType === 'Paternity Leave') update.endDate = addWorkingDays(sd, PATERNITY_DAYS, holidays);
    setForm(f => ({ ...f, ...update }));
    recalc({ ...form, ...update });
  }

  function recalc(f = form) {
    if (f.startDate && f.endDate) {
      const wd = calcWorkingDays(f.startDate, f.endDate, holidays);
      setPreview(wd);
    }
  }

  const staff = useMemo(() => {
    const selected = allStaff.find(s => s.id === parseInt(form.staffId));
    return selected;
  }, [allStaff, form.staffId]);

  const mutation = useMutation(
    (d) => leaveApi.submit(d),
    {
      onSuccess: () => {
        toast.success('Leave request submitted for approval.');
        setForm({ staffId: '', leaveType: 'Annual Leave', startDate: today, endDate: today, notes: '' });
        setPreview(null);
        setFeedback(null);
        qc.invalidateQueries('leave-overview');
        qc.invalidateQueries('lms-requests');
      },
      onError: (err) => {
        setFeedback(err.response?.data?.error || 'Submission failed.');
      },
    }
  );

  function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    if (!form.staffId) return setFeedback('Please select a staff member.');
    if (!form.startDate || !form.endDate) return setFeedback('Start and end dates are required.');
    if (form.endDate < form.startDate) return setFeedback('End date cannot be before start date.');
    const workingDays = calcWorkingDays(form.startDate, form.endDate, holidays);
    if (workingDays === 0) return setFeedback('No working days in the selected range.');
    mutation.mutate({
      staffId: parseInt(form.staffId),
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      workingDays,
      year,
      notes: form.notes || undefined,
    });
  }

  // Group staff by team for the dropdown
  const grouped = useMemo(() => {
    const map = {};
    allStaff.forEach(s => {
      const key = s.team_name || 'Unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allStaff]);

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Submit Leave Request</h2>

      {feedback && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{feedback}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Staff Member</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.staffId} onChange={e => set('staffId', e.target.value)} required>
            <option value="">— Select staff —</option>
            {Object.entries(grouped).map(([team, members]) => (
              <optgroup key={team} label={team}>
                {members.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.leaveType} onChange={e => handleTypeChange(e.target.value)}>
            {LEAVE_TYPES.map(lt => <option key={lt}>{lt}</option>)}
          </select>
          {isGift && (
            <p className="mt-1 text-xs text-teal-600 font-medium">
              🎁 Gift leave — does not reduce annual balance.
              {form.leaveType === 'Maternity Leave' ? ` Standard: ${MATERNITY_DAYS} working days.` : ` Standard: ${PATERNITY_DAYS} working days.`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.startDate} min={today}
              onChange={e => { handleStartChange(e.target.value); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.endDate} min={form.startDate}
              onChange={e => { set('endDate', e.target.value); recalc({ ...form, endDate: e.target.value }); }}
            />
          </div>
        </div>

        {preview !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
            <strong>{preview} working day{preview !== 1 ? 's' : ''}</strong>
            {staff && !isGift && form.leaveType === 'Annual Leave' && (
              <span className="text-blue-600"> · {staff.name} has {staff.annual_entitlement} days entitlement this year</span>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <button type="submit" disabled={mutation.isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          {mutation.isLoading ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </form>
    </div>
  );
}

// ─── Approvals tab ────────────────────────────────────────────────────────────
function ApprovalsTab() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery(
    'lms-pending',
    () => leaveApi.requests({ status: 'Pending' }).then(r => r.data),
    { refetchInterval: 30000 }
  );
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason]     = useState('');

  const approve = useMutation(id => leaveApi.approve(id), {
    onSuccess: () => { toast.success('Approved.'); qc.invalidateQueries('lms-pending'); qc.invalidateQueries('leave-overview'); },
    onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const reject = useMutation(({ id, reason }) => leaveApi.reject(id, { reason }), {
    onSuccess: () => {
      toast.success('Rejected.');
      setRejectId(null); setReason('');
      qc.invalidateQueries('lms-pending'); qc.invalidateQueries('leave-overview');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const pending = data?.requests || [];

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Approval Queue <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pending.length}</span>
        </h2>
        <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {!pending.length
        ? <div className="text-center py-12 text-gray-400">
            <CheckCircle size={40} className="mx-auto mb-2 text-green-300" />
            <p className="text-sm">No pending requests.</p>
          </div>
        : <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-wrap gap-2 items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.staff_name}</p>
                    <p className="text-xs text-gray-500">{r.team_name} · {r.dept_name}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge color="blue">{r.leave_type}</Badge>
                      {r.is_gift_leave && <Badge color="purple">🎁 Gift</Badge>}
                      <span className="text-xs text-gray-500">
                        {fmtDate(r.start_date)} – {fmtDate(r.end_date)} · <strong>{r.working_days} days</strong>
                      </span>
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 mt-1 italic">"{r.notes}"</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {rejectId === r.id
                      ? null
                      : <>
                          <button onClick={() => approve.mutate(r.id)}
                            disabled={approve.isLoading}
                            className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button onClick={() => { setRejectId(r.id); setReason(''); }}
                            className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg transition-colors">
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                    }
                  </div>
                </div>
                {rejectId === r.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <input type="text" placeholder="Reason for rejection (optional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-2"
                      value={reason} onChange={e => setReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => reject.mutate({ id: r.id, reason })}
                        disabled={reject.isLoading}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg">
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejectId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── Records tab ──────────────────────────────────────────────────────────────
function RecordsTab() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState({ status: '', year: currentYear, team: '' });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery(
    ['lms-requests', filters],
    () => leaveApi.requests({ ...filters, limit: 200 }).then(r => r.data)
  );

  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  const del = useMutation(id => leaveApi.deleteReq(id), {
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries('lms-requests'); },
    onError:   e  => toast.error(e.response?.data?.error || 'Delete failed.'),
  });

  const rows = data?.requests || [];

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.year} onChange={e => setF('year', e.target.value)}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.status} onChange={e => setF('status', e.target.value)}>
            <option value="">All</option>
            <option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Team</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.team} onChange={e => setF('team', e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {isLoading
        ? <div className="text-sm text-gray-400">Loading…</div>
        : !rows.length
          ? <div className="text-center py-12 text-gray-400 text-sm">No records found.</div>
          : <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Staff', 'Team', 'Type', 'Dates', 'Days', 'Status', 'Submitted'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{r.staff_name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{r.team_name}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs">{r.leave_type}</span>
                        {r.is_gift_leave && <span className="ml-1 text-teal-600">🎁</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.working_days}</td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{r.submitted_by}</td>
                      <td className="px-3 py-2">
                        {r.status === 'Pending' && (
                          <button onClick={() => { if (window.confirm('Delete this request?')) del.mutate(r.id); }}
                            className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// ─── Balances tab ─────────────────────────────────────────────────────────────
function BalancesTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]       = useState(currentYear);
  const [lowOnly, setLowOnly] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');

  const { data = [], isLoading } = useQuery(
    ['lms-balances', year, teamFilter],
    () => leaveApi.balances({ year, team: teamFilter || undefined }).then(r => r.data)
  );

  const filtered = lowOnly ? data.filter(s => s.remaining <= 7) : data;

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={year} onChange={e => setYear(e.target.value)}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
          Low balance only (≤7 days)
        </label>
      </div>

      {isLoading
        ? <div className="text-sm text-gray-400">Loading…</div>
        : <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Staff', 'Team', 'Department', 'Entitlement', 'Used', 'Remaining', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => {
                  const pct = Math.max(0, Math.min(100, (s.remaining / s.annual_entitlement) * 100));
                  const color = s.remaining <= 0 ? 'bg-red-500' : s.remaining <= 5 ? 'bg-amber-400' : 'bg-green-400';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.team}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{s.dept}</td>
                      <td className="px-3 py-2 text-center">{s.annual_entitlement}</td>
                      <td className="px-3 py-2 text-center text-amber-600">{s.used}</td>
                      <td className="px-3 py-2 text-center font-semibold">
                        <span className={s.remaining <= 5 ? 'text-red-600' : 'text-gray-900'}>{s.remaining}</span>
                      </td>
                      <td className="px-3 py-2 w-24">
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────────────
function RosterTab() {
  const qc = useQueryClient();
  const { data: depts = [], isLoading } = useQuery('lms-departments', () => leaveApi.departments().then(r => r.data));
  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));

  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const [newDept, setNewDept] = useState('');
  const [newTeams, setNewTeams] = useState({});  // deptId → name
  const [addingStaff, setAddingStaff] = useState(null); // teamId
  const [newStaff, setNewStaff] = useState({ name: '', role: 'staff' });

  const createDept = useMutation(() => leaveApi.createDept({ name: newDept }), {
    onSuccess: () => { setNewDept(''); qc.invalidateQueries('lms-departments'); toast.success('Department created.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const addTeam = useMutation(({ deptId, name }) => leaveApi.addTeam(deptId, { name }), {
    onSuccess: (_, { deptId }) => { setNewTeams(t => ({ ...t, [deptId]: '' })); qc.invalidateQueries('lms-departments'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const deleteDept = useMutation(id => leaveApi.deleteDept(id), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); toast.success('Deleted.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const deleteTeam = useMutation(({ deptId, teamId }) => leaveApi.deleteTeam(deptId, teamId), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); toast.success('Team removed.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const createStaff = useMutation(
    ({ teamId }) => leaveApi.addStaff({ teamId, name: newStaff.name, role: newStaff.role }),
    {
      onSuccess: () => {
        setAddingStaff(null); setNewStaff({ name: '', role: 'staff' });
        qc.invalidateQueries('lms-staff'); qc.invalidateQueries('lms-departments');
        toast.success('Staff added.');
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const removeStaff = useMutation(id => leaveApi.removeStaff(id), {
    onSuccess: () => { qc.invalidateQueries('lms-staff'); toast.success('Staff deactivated.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading…</div>;

  const staffByTeam = {};
  allStaff.forEach(s => {
    if (!staffByTeam[s.team_id]) staffByTeam[s.team_id] = [];
    staffByTeam[s.team_id].push(s);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Add department */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Department</h3>
        <div className="flex gap-2">
          <input type="text" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Department name" value={newDept} onChange={e => setNewDept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newDept.trim() && createDept.mutate()} />
          <button onClick={() => newDept.trim() && createDept.mutate()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">
            Create
          </button>
        </div>
      </div>

      {/* Departments */}
      {depts.map(d => (
        <div key={d.id} className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggle(d.id)}>
            <span className="font-semibold text-sm text-gray-900">{d.name}</span>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${d.name}"?`)) deleteDept.mutate(d.id); }}
                className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
              {expanded[d.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expanded[d.id] && (
            <div className="border-t border-gray-100 p-4 space-y-4">
              {/* Add team */}
              <div className="flex gap-2">
                <input type="text" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="New team name"
                  value={newTeams[d.id] || ''}
                  onChange={e => setNewTeams(t => ({ ...t, [d.id]: e.target.value }))} />
                <button onClick={() => { const name = newTeams[d.id]?.trim(); if (name) addTeam.mutate({ deptId: d.id, name }); }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
                  Add Team
                </button>
              </div>

              {/* Teams */}
              {(d.teams || []).map(t => (
                <div key={t.id} className="border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-t-lg">
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-400">{t.member_count} members</span>
                      <button onClick={() => setAddingStaff(addingStaff === t.id ? null : t.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <UserPlus size={13} /> Add
                      </button>
                      <button onClick={() => { if (window.confirm(`Remove team "${t.name}"?`)) deleteTeam.mutate({ deptId: d.id, teamId: t.id }); }}
                        className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {addingStaff === t.id && (
                    <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
                      <input type="text" placeholder="Full name"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                        value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))} />
                      <select className="border border-gray-300 rounded px-2 py-1 text-xs"
                        value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}>
                        <option value="staff">Staff</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                      <button onClick={() => newStaff.name.trim() && createStaff.mutate({ teamId: t.id })}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Add</button>
                    </div>
                  )}

                  <div className="divide-y divide-gray-100">
                    {(staffByTeam[t.id] || []).filter(s => s.is_active).map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-1.5">
                        <div>
                          <span className="text-xs text-gray-900">{s.name}</span>
                          <Badge color={s.role === 'supervisor' ? 'purple' : 'gray'}>
                            {s.role}
                          </Badge>
                        </div>
                        <button onClick={() => { if (window.confirm(`Remove ${s.name}?`)) removeStaff.mutate(s.id); }}
                          className="text-red-300 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Holidays tab ─────────────────────────────────────────────────────────────
function HolidaysTab() {
  const qc = useQueryClient();
  const { data: holidays = [], isLoading } = useQuery('lms-holidays', () => leaveApi.holidays().then(r => r.data));
  const [form, setForm] = useState({ date: '', name: '' });

  const add = useMutation(() => leaveApi.addHoliday(form), {
    onSuccess: () => { setForm({ date: '', name: '' }); qc.invalidateQueries('lms-holidays'); toast.success('Holiday added.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const del = useMutation(id => leaveApi.deleteHoliday(id), {
    onSuccess: () => { qc.invalidateQueries('lms-holidays'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <div className="p-6 max-w-lg space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Public Holidays</h2>

      <div className="flex gap-2">
        <input type="date" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <input type="text" placeholder="Holiday name" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <button onClick={() => form.date && form.name && add.mutate()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg">
          <Plus size={16} />
        </button>
      </div>

      {isLoading
        ? <div className="text-sm text-gray-400">Loading…</div>
        : <div className="rounded-xl border border-gray-200 overflow-hidden">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.name}</p>
                  <p className="text-xs text-gray-400">{fmtDate(h.date)}</p>
                </div>
                <button onClick={() => del.mutate(h.id)} className="text-red-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isSupervisor = hasRole('supervisor');

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <ShieldOff size={48} className="text-gray-300" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">Leave Management is only available to Supervisors and Admins.</p>
      </div>
    );
  }

  const [tab, setTab] = useState('overview');

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <CalendarDays size={20} className="text-blue-600" />
          <h1 className="text-base font-bold text-gray-900">Leave Management</h1>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            {new Date().getFullYear()}
          </span>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {tab === 'overview'  && <OverviewTab />}
        {tab === 'submit'    && <SubmitTab />}
        {tab === 'approvals' && isAdmin && <ApprovalsTab />}
        {tab === 'records'   && <RecordsTab />}
        {tab === 'balances'  && <BalancesTab />}
        {tab === 'roster'    && isAdmin && <RosterTab />}
        {tab === 'holidays'  && isAdmin && <HolidaysTab />}
      </div>
    </div>
  );
}
