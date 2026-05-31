import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  CalendarDays, Users, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Trash2, UserPlus, ShieldOff,
  ClipboardList, Upload, Download, Search, ChevronRight, Pencil, X,
  ArrowRightLeft,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAVE_TYPES = [
  'Annual Leave', 'Sick Leave', 'Compassionate Leave',
  'Maternity Leave', 'Paternity Leave',
];
const GIFT_TYPES   = ['Maternity Leave', 'Paternity Leave'];
const MATERNITY_WD = 65;
const PATERNITY_WD = 9;

const ROLE_OPTIONS = [
  { value: 'staff',        label: 'Staff',                         ent: 18 },
  { value: 'supervisor',   label: 'Supervisor (Spvr)',             ent: 21 },
  { value: 'm_supervisor', label: "Marshal's Supervisor (M Spvr)", ent: 21 },
  { value: 'maintenance',  label: 'Maintenance Officer',           ent: 21 },
];
function entitlementForRole(role) {
  return ['supervisor', 'm_supervisor', 'maintenance'].includes(role) ? 21 : 18;
}
function roleLabel(role) {
  return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
}

// ─── Working-day helpers ──────────────────────────────────────────────────────
function calcWorkingDays(start, end, holidays) {
  if (!start || !end) return 0;
  const hSet = new Set((holidays || []).map(h => h.date?.slice(0, 10)));
  let count = 0;
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    const dow = cur.getDay();
    const ds  = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !hSet.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function addWorkingDays(startDate, numDays, holidays) {
  if (!startDate || numDays <= 0) return startDate;
  const hSet = new Set((holidays || []).map(h => h.date?.slice(0, 10)));
  const cur = new Date(startDate + 'T00:00:00');
  let counted = 0;
  const startDow = cur.getDay();
  const startDs  = cur.toISOString().slice(0, 10);
  if (startDow !== 0 && startDow !== 6 && !hSet.has(startDs)) counted = 1;
  while (counted < numDays) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    const ds  = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !hSet.has(ds)) counted++;
  }
  return cur.toISOString().slice(0, 10);
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

// ─── CSV export helper ────────────────────────────────────────────────────────
function exportCSV(filename, rows) {
  if (!rows.length) { toast.error('No data to export.'); return; }
  const keys = Object.keys(rows[0]);
  const escape = v => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const cls = {
    green:  'bg-green-100 text-green-700 border border-green-200',
    amber:  'bg-amber-100 text-amber-700 border border-amber-200',
    red:    'bg-red-100 text-red-700 border border-red-200',
    blue:   'bg-blue-100 text-blue-700 border border-blue-200',
    gray:   'bg-gray-100 text-gray-600 border border-gray-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
    teal:   'bg-teal-100 text-teal-700 border border-teal-200',
  }[color] || 'bg-gray-100 text-gray-600';
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function StatusBadge({ status }) {
  if (status === 'Approved') return <Badge color="green">✓ Approved</Badge>;
  if (status === 'Rejected') return <Badge color="red">✗ Rejected</Badge>;
  return <Badge color="amber">⏳ Pending</Badge>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtShort(d) {
  if (!d) return '—';
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function Spinner() { return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>; }
function Card({ title, children, action }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const currentYear = new Date().getFullYear();
const todayStr    = new Date().toISOString().slice(0, 10);
const in7days     = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading } = useQuery(
    'leave-overview',
    () => leaveApi.overview().then(r => r.data),
    { refetchInterval: 60_000 }
  );

  // Fetch upcoming leave (next 7 days) from requests
  const { data: upcomingData } = useQuery(
    ['lms-requests', { status: 'Approved', year: currentYear }],
    () => leaveApi.requests({ status: 'Approved', year: currentYear, limit: 500 }).then(r => r.data)
  );

  const upcoming = useMemo(() => {
    if (!upcomingData?.requests) return [];
    return upcomingData.requests.filter(r =>
      r.start_date > todayStr && r.start_date <= in7days
    ).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [upcomingData]);

  if (isLoading) return <Spinner />;
  const { onLeave = [], pendingCount = 0, lowBalance = [] } = data || {};

  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-4">
          <CalendarDays size={22} className="text-blue-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{onLeave.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">On Leave Today</p>
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-4">
          <Clock size={22} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending Manual Review</p>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 flex items-center gap-4">
          <AlertTriangle size={22} className="text-red-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{lowBalance.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Low Balances (≤5 days)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On leave today */}
        <Card title="On Leave Today">
          {!onLeave.length
            ? <p className="text-sm text-gray-400 py-4 text-center">No one is on leave today.</p>
            : onLeave.map(r => (
                <div key={r.id} className="flex justify-between items-center py-2.5 border-b last:border-0 border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.team} · Returns {fmtDate(r.end_date)}</p>
                  </div>
                  <Badge color="blue">{r.leave_type.replace(' Leave', '')}</Badge>
                </div>
              ))
          }
        </Card>

        {/* Upcoming in next 7 days */}
        <Card title="Starting Leave (Next 7 Days)">
          {!upcoming.length
            ? <p className="text-sm text-gray-400 py-4 text-center">No leave starting in the next 7 days.</p>
            : upcoming.slice(0, 8).map(r => (
                <div key={r.id} className="flex justify-between items-center py-2.5 border-b last:border-0 border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.staff_name}</p>
                    <p className="text-xs text-gray-400">{r.team_name} · {r.working_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-700">{fmtShort(r.start_date)}</p>
                    <p className="text-xs text-gray-400">→ {fmtShort(r.end_date)}</p>
                  </div>
                </div>
              ))
          }
        </Card>
      </div>

      {/* Low balance */}
      {lowBalance.length > 0 && (
        <Card title="Staff with Low Leave Balance (≤5 days remaining)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lowBalance.map(s => {
              // Correct calculation: entitlement + carry-over - current year used
              const carryOver  = Math.max(0, s.annual_entitlement - (s.used_prev || 0));
              const totalBudget = s.annual_entitlement + carryOver;
              const remaining  = totalBudget - (s.used_current || 0);
              const pct = Math.max(0, Math.min(100, (remaining / Math.max(1, totalBudget)) * 100));
              return (
                <div key={s.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className={`font-bold text-sm ${remaining <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {remaining <= 0 ? 'Exhausted' : `${remaining} days left`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1.5">{s.team}</p>
                  <div className="h-1.5 bg-gray-200 rounded-full">
                    <div className={`h-full rounded-full ${remaining <= 0 ? 'bg-red-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Submit tab ───────────────────────────────────────────────────────────────
function SubmitTab() {
  const qc = useQueryClient();
  const { data: allStaff = [] }  = useQuery('lms-staff',    () => leaveApi.staff().then(r => r.data));
  const { data: holidays = [] }  = useQuery('lms-holidays', () => leaveApi.holidays().then(r => r.data));

  const [form, setForm] = useState({
    staffId: '', leaveType: 'Annual Leave', entitlementYear: currentYear,
    startDate: todayStr, numDays: '', endDate: '', notes: '',
  });
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isGift = GIFT_TYPES.includes(form.leaveType);

  const selectedStaff = useMemo(
    () => allStaff.find(s => s.id === parseInt(form.staffId)),
    [allStaff, form.staffId]
  );

  // Balance for selected staff
  const { data: staffBalance } = useQuery(
    ['lms-staff-balance', form.staffId, form.entitlementYear],
    () => leaveApi.balances({ year: form.entitlementYear }).then(r => r.data),
    { enabled: !!form.staffId, select: data => data.find(s => s.id === parseInt(form.staffId)) }
  );

  // Team leave overlap — fetch approved requests for the same team
  const { data: teamRequests = [] } = useQuery(
    ['lms-team-requests', selectedStaff?.team_name, currentYear],
    () => leaveApi.requests({ team: selectedStaff.team_name, status: 'Approved', year: currentYear, limit: 200 })
            .then(r => r.data.requests || []),
    { enabled: !!selectedStaff?.team_name }
  );

  const teamClashes = useMemo(() => {
    if (!form.startDate || !form.endDate || !selectedStaff) return [];
    return teamRequests.filter(r =>
      r.staff_id !== parseInt(form.staffId) &&
      datesOverlap(form.startDate, form.endDate, r.start_date.slice(0, 10), r.end_date.slice(0, 10))
    );
  }, [teamRequests, form.startDate, form.endDate, form.staffId, selectedStaff]);

  function handleTypeChange(lt) {
    const patch = { leaveType: lt };
    if (lt === 'Maternity Leave') patch.numDays = MATERNITY_WD;
    else if (lt === 'Paternity Leave') patch.numDays = PATERNITY_WD;
    const newForm = { ...form, ...patch };
    setForm(newForm);
    if (newForm.startDate && newForm.numDays)
      setForm(f => ({ ...f, ...patch, endDate: addWorkingDays(newForm.startDate, parseInt(newForm.numDays), holidays) }));
  }

  function handleStartChange(sd) {
    set('startDate', sd);
    if (form.numDays && parseInt(form.numDays) > 0)
      set('endDate', addWorkingDays(sd, parseInt(form.numDays), holidays));
  }

  function handleDaysChange(d) {
    set('numDays', d);
    const n = parseInt(d);
    set('endDate', form.startDate && n > 0 ? addWorkingDays(form.startDate, n, holidays) : '');
  }

  const mutation = useMutation(d => leaveApi.submit(d), {
    onSuccess: res => {
      setResult(res.data);
      toast.success('Leave request submitted — awaiting approval.');
      setForm({ staffId: '', leaveType: 'Annual Leave', entitlementYear: currentYear, startDate: todayStr, numDays: '', endDate: '', notes: '' });
      qc.invalidateQueries('leave-overview');
      qc.invalidateQueries('lms-requests');
      qc.invalidateQueries('lms-balances');
      qc.invalidateQueries('lms-staff-balance');
    },
    onError: err => {
      setResult({ error: err.response?.data?.error || 'Submission failed.' });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    if (!form.staffId) return toast.error('Select a staff member.');
    const n = parseInt(form.numDays);
    if (!form.startDate || !n || n <= 0) return toast.error('Enter start date and number of days.');
    if (!form.endDate) return toast.error('End date could not be calculated.');
    const workingDays = calcWorkingDays(form.startDate, form.endDate, holidays);
    if (workingDays === 0) return toast.error('No working days in the selected range.');
    mutation.mutate({
      staffId: parseInt(form.staffId),
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      workingDays,
      year: currentYear,
      entitlementYear: form.entitlementYear,
      notes: form.notes || undefined,
    });
  }

  const grouped = useMemo(() => {
    const map = {};
    allStaff.forEach(s => {
      const key = `${s.dept_name || 'Other'} › ${s.team_name || 'Unassigned'}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allStaff]);

  const sl = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Submit Leave Request</h2>
      <p className="text-xs text-gray-500 mb-4">
        All submitted requests require manual approval by an admin.
      </p>

      {/* Submission confirmation banner */}
      {result && !result.error && (
        <div className="mb-4 p-4 rounded-xl border text-sm bg-blue-50 border-blue-200 text-blue-800">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <Clock size={15} /> Request Submitted — Pending Approval
          </div>
          <p className="text-xs mt-1">
            {result.staff_name} · {result.leave_type} · {fmtDate(result.start_date)} – {fmtDate(result.end_date)} · {result.working_days} working days
          </p>
          {result.clash_with && (
            <p className="text-xs mt-1 text-amber-700">
              Note: team overlap with {result.clash_with} — reviewer should be aware.
            </p>
          )}
        </div>
      )}
      {result?.error && (
        <div className="mb-4 p-4 rounded-xl border text-sm bg-red-50 border-red-200 text-red-800">
          <div className="flex items-center gap-2 font-semibold"><XCircle size={15} /> Submission Failed</div>
          <p className="text-xs mt-1">{result.error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Staff */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Staff Member</label>
          <select className={sl} value={form.staffId}
            onChange={e => { set('staffId', e.target.value); setResult(null); }} required>
            <option value="">— Select staff member —</option>
            {Object.entries(grouped).map(([group, members]) => (
              <optgroup key={group} label={group}>
                {members.map(s => <option key={s.id} value={s.id}>{s.name} ({roleLabel(s.role)})</option>)}
              </optgroup>
            ))}
          </select>

          {/* Balance preview */}
          {staffBalance && !isGift && form.leaveType === 'Annual Leave' && (
            <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
              {[
                { label: 'Entitlement', val: staffBalance.annual_entitlement, color: 'text-gray-700' },
                { label: 'Carry-over',  val: staffBalance.carry_over > 0 ? `+${staffBalance.carry_over}` : '—', color: 'text-teal-600' },
                { label: 'Used',        val: staffBalance.used,      color: 'text-amber-600' },
                { label: 'Remaining',   val: staffBalance.remaining, color: staffBalance.remaining <= 5 ? 'text-red-600 font-bold' : 'text-green-600 font-bold' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg px-2 py-1.5 text-center border border-gray-100">
                  <p className={`text-sm font-semibold ${color}`}>{val}</p>
                  <p className="text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
          <select className={sl} value={form.leaveType} onChange={e => handleTypeChange(e.target.value)}>
            {LEAVE_TYPES.map(lt => <option key={lt}>{lt}</option>)}
          </select>
          {isGift && (
            <p className="mt-1 text-xs text-teal-600 font-medium">
              Gift leave — does not reduce annual balance.
              {form.leaveType === 'Maternity Leave' ? ` Standard: ${MATERNITY_WD} working days.` : ` Standard: ${PATERNITY_WD} working days.`}
            </p>
          )}
        </div>

        {/* Entitlement year */}
        {!isGift && form.leaveType === 'Annual Leave' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Draw from year
              <span className="ml-1 text-gray-400 font-normal">(use previous year to draw carry-over first)</span>
            </label>
            <select className={sl} value={form.entitlementYear}
              onChange={e => set('entitlementYear', parseInt(e.target.value))}>
              <option value={currentYear - 1}>{currentYear - 1} (carry-over)</option>
              <option value={currentYear}>{currentYear} (current year)</option>
            </select>
          </div>
        )}

        {/* Start + days */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input type="date" className={sl} value={form.startDate}
              onChange={e => handleStartChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Number of Days</label>
            <input type="number" min="1" max="365" className={sl} placeholder="e.g. 10"
              value={form.numDays}
              disabled={form.leaveType === 'Maternity Leave' || form.leaveType === 'Paternity Leave'}
              onChange={e => handleDaysChange(e.target.value)} />
          </div>
        </div>

        {/* End date preview */}
        {form.endDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-blue-800">{fmtDate(form.startDate)} → {fmtDate(form.endDate)}</span>
              <span className="text-xs text-blue-500">{form.numDays} working days</span>
            </div>
          </div>
        )}

        {/* Team clash preview */}
        {form.endDate && selectedStaff?.team_name && (
          <div className={`rounded-lg border px-4 py-3 text-xs ${
            teamClashes.length > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <p className="font-semibold mb-1.5 flex items-center gap-1.5">
              {teamClashes.length > 0
                ? <><AlertTriangle size={13} className="text-amber-500" /> Team overlap detected — {selectedStaff.team_name}</>
                : <><CheckCircle size={13} className="text-green-500" /> No team overlap — {selectedStaff.team_name}</>}
            </p>
            {teamClashes.length > 0 && (
              <div className="space-y-1">
                {teamClashes.map(r => (
                  <p key={r.id} className="text-amber-700">
                    {r.staff_name}: {fmtShort(r.start_date)} – {fmtShort(r.end_date)} ({r.leave_type.replace(' Leave', '')})
                  </p>
                ))}
                <p className="text-amber-600 mt-1 font-medium">The reviewer will see this overlap when approving or rejecting.</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea className={sl} rows={2} value={form.notes}
            onChange={e => set('notes', e.target.value)} />
        </div>

        <button type="submit" disabled={mutation.isLoading || !form.endDate}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {mutation.isLoading ? 'Processing…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}

// ─── Records tab ──────────────────────────────────────────────────────────────
function RecordsTab({ isAdmin }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', year: currentYear, team: '', leaveType: '' });
  const [search, setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery(
    ['lms-requests', filters],
    () => leaveApi.requests({ ...filters, limit: 500 }).then(r => r.data)
  );

  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  const del = useMutation(id => leaveApi.deleteReq(id), {
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries('lms-requests'); },
    onError: e => toast.error(e.response?.data?.error || 'Delete failed.'),
  });

  const override = useMutation(({ id, action, reason }) =>
    action === 'approve' ? leaveApi.approve(id) : leaveApi.reject(id, { reason }), {
    onSuccess: (_, { action }) => {
      toast.success(action === 'approve' ? 'Overridden: Approved.' : 'Overridden: Rejected.');
      qc.invalidateQueries('lms-requests');
      qc.invalidateQueries('leave-overview');
      qc.invalidateQueries('lms-balances');
    },
    onError: e => toast.error(e.response?.data?.error || 'Override failed.'),
  });

  const allRows = data?.requests || [];

  // Client-side name + leave-type filter
  const rows = useMemo(() => {
    let r = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => x.staff_name?.toLowerCase().includes(q) || x.team_name?.toLowerCase().includes(q));
    }
    if (filters.leaveType) r = r.filter(x => x.leave_type === filters.leaveType);
    return r;
  }, [allRows, search, filters.leaveType]);

  function handleExport() {
    exportCSV(`leave-records-${filters.year}.csv`, rows.map(r => ({
      Staff: r.staff_name,
      Team: r.team_name,
      Department: r.dept_name,
      'Leave Type': r.leave_type,
      'Entitlement Year': r.entitlement_year || r.year,
      'Start Date': r.start_date?.slice(0, 10),
      'End Date': r.end_date?.slice(0, 10),
      'Working Days': r.working_days,
      Status: r.status,
      'Decision By': r.status === 'Approved' ? r.approved_by : r.rejected_by || '',
      'Rejection Reason': r.rejection_reason || '',
      Notes: r.notes || '',
    })));
  }

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm"
              placeholder="Name or team…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.year} onChange={e => setF('year', e.target.value)}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.status} onChange={e => setF('status', e.target.value)}>
            {[{ v: '', l: 'All' }, { v: 'Approved', l: 'Approved' }, { v: 'Rejected', l: 'Rejected' }, { v: 'Pending', l: 'Pending' }]
              .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {/* Team */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Team</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.team} onChange={e => setF('team', e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Leave type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Leave Type</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={filters.leaveType} onChange={e => setF('leaveType', e.target.value)}>
            <option value="">All types</option>
            {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Export */}
        <button onClick={handleExport}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>

      {isLoading ? <Spinner /> : !rows.length
        ? <div className="text-center py-12 text-gray-400 text-sm">No records found.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Staff', 'Team', 'Type', 'Year', 'Dates', 'Days', 'Status', 'Decision By', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className={`hover:bg-gray-50 cursor-pointer ${r.rejection_reason ? 'cursor-pointer' : ''}`}
                      onClick={() => r.rejection_reason && setExpanded(expanded === r.id ? null : r.id)}>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {r.rejection_reason && (
                            <span className="text-gray-300">
                              {expanded === r.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                          )}
                          {r.staff_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.team_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {r.leave_type}
                        {r.is_gift_leave && <span className="ml-1 text-teal-600">🎁</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">{r.entitlement_year || r.year}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                      </td>
                      <td className="px-3 py-2 font-medium text-center">{r.working_days}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {r.status === 'Approved' ? (r.approved_by || '—') : (r.rejected_by || '—')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {r.status !== 'Approved' && (
                              <button onClick={() => override.mutate({ id: r.id, action: 'approve' })}
                                title="Override: Approve" className="text-green-400 hover:text-green-600">
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {r.status !== 'Rejected' && (
                              <button title="Override: Reject"
                                onClick={() => { const reason = prompt('Reason for rejection:'); if (reason !== null) override.mutate({ id: r.id, action: 'reject', reason }); }}
                                className="text-red-300 hover:text-red-500"><XCircle size={14} /></button>
                            )}
                            <button onClick={() => { if (window.confirm('Delete this record?')) del.mutate(r.id); }}
                              title="Delete" className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Inline rejection reason */}
                    {expanded === r.id && r.rejection_reason && (
                      <tr className="bg-red-50">
                        <td colSpan={9} className="px-6 py-2.5 text-xs text-red-700">
                          <span className="font-semibold">Rejection reason: </span>{r.rejection_reason}
                          {r.notes && <span className="ml-3 text-gray-500">Notes: {r.notes}</span>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ─── Balances tab ─────────────────────────────────────────────────────────────
function BalancesTab() {
  const [year, setYear]         = useState(currentYear);
  const [lowOnly, setLowOnly]   = useState(false);
  const [teamFilter, setTeam]   = useState('');
  const [deptFilter, setDept]   = useState('');

  const { data = [], isLoading } = useQuery(
    ['lms-balances', year, teamFilter, deptFilter],
    () => leaveApi.balances({ year, team: teamFilter || undefined, dept: deptFilter || undefined }).then(r => r.data)
  );

  const { data: allStaff = [] }  = useQuery('lms-staff',       () => leaveApi.staff().then(r => r.data));
  const { data: depts    = [] }  = useQuery('lms-departments', () => leaveApi.departments().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  const filtered = lowOnly ? data.filter(s => s.remaining <= 7) : data;

  // Org summary
  const summary = useMemo(() => ({
    total:  filtered.reduce((s, r) => s + r.total_budget, 0),
    used:   filtered.reduce((s, r) => s + r.used, 0),
    remaining: filtered.reduce((s, r) => s + r.remaining, 0),
  }), [filtered]);

  function handleExport() {
    exportCSV(`leave-balances-${year}.csv`, filtered.map(s => ({
      Name: s.name,
      Role: roleLabel(s.role),
      Team: s.team,
      Department: s.dept,
      Entitlement: s.annual_entitlement,
      'Carry-over': s.carry_over,
      'Total Budget': s.total_budget,
      Used: s.used,
      Remaining: s.remaining,
    })));
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        {/* Year */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Department</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={deptFilter} onChange={e => { setDept(e.target.value); setTeam(''); }}>
            <option value="">All departments</option>
            {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        {/* Team */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Team</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={teamFilter} onChange={e => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Low balance toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-0.5">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
          Low balance only (≤7 days)
        </label>

        {/* Export */}
        <button onClick={handleExport}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg ml-auto">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Staff', 'Role', 'Team', 'Entitlement', 'Carry-over', 'Total', 'Used', 'Remaining', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => {
                  const pct      = Math.max(0, Math.min(100, (s.remaining / Math.max(1, s.total_budget)) * 100));
                  const barColor = s.remaining <= 0 ? 'bg-red-500' : s.remaining <= 5 ? 'bg-amber-400' : 'bg-green-400';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{roleLabel(s.role)}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{s.team}</td>
                      <td className="px-3 py-2 text-center text-xs">{s.annual_entitlement}</td>
                      <td className="px-3 py-2 text-center text-xs text-teal-600 font-medium">
                        {s.carry_over > 0 ? `+${s.carry_over}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-xs">{s.total_budget}</td>
                      <td className="px-3 py-2 text-center text-amber-600 text-xs font-medium">{s.used}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold text-sm ${s.remaining <= 0 ? 'text-red-600' : s.remaining <= 5 ? 'text-amber-600' : 'text-gray-800'}`}>
                          {s.remaining}
                        </span>
                      </td>
                      <td className="px-3 py-2 w-20">
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary row */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-500">{filtered.length} staff</td>
                    <td className="px-3 py-2 text-center text-xs font-bold text-gray-700">{summary.total}</td>
                    <td className="px-3 py-2 text-center text-xs font-bold text-amber-600">{summary.used}</td>
                    <td className="px-3 py-2 text-center text-xs font-bold text-gray-800">{summary.remaining}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Carry-over = unused days from {year - 1}. Total = Entitlement + Carry-over. Remaining = Total – Used.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Staff Modal (add / edit) ─────────────────────────────────────────────────
function StaffModal({ staff, defaultTeamId, allTeams, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!staff;

  const [form, setForm] = useState({
    name:             staff?.name              || '',
    role:             staff?.role              || 'staff',
    teamId:           staff?.team_id?.toString() || defaultTeamId?.toString() || '',
    annualEntitlement: staff?.annual_entitlement ?? entitlementForRole(staff?.role || 'staff'),
    customEnt:        false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill entitlement when role changes (unless user overrode it)
  const handleRoleChange = (role) => {
    set('role', role);
    if (!form.customEnt) set('annualEntitlement', entitlementForRole(role));
  };

  const ROLE_COLOR = {
    supervisor: 'border-purple-300 bg-purple-50',
    m_supervisor: 'border-blue-300 bg-blue-50',
    maintenance: 'border-teal-300 bg-teal-50',
    staff: 'border-gray-200 bg-white',
  };

  const mut = useMutation(
    (d) => isEdit
      ? leaveApi.updateStaff(staff.id, d)
      : leaveApi.addStaff(d),
    {
      onSuccess: () => {
        toast.success(isEdit ? 'Member updated.' : 'Member added to roster.');
        qc.invalidateQueries('lms-staff');
        qc.invalidateQueries('lms-departments');
        onClose();
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required.');
    mut.mutate({
      name:             form.name.trim(),
      role:             form.role,
      teamId:           form.teamId ? parseInt(form.teamId) : null,
      annualEntitlement: parseInt(form.annualEntitlement),
      isActive:         true,
    });
  };

  const sl = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? `Edit — ${staff.name}` : 'Add Staff Member'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input className={sl} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Kwame Asante" />
          </div>

          {/* Role — visual selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(r => (
                <button type="button" key={r.value}
                  onClick={() => handleRoleChange(r.value)}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    form.role === r.value
                      ? ROLE_COLOR[r.value] + ' border-opacity-100'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}>
                  <span className="text-xs font-semibold text-gray-800">{r.label}</span>
                  <span className="text-xs text-gray-400">{r.ent} days entitlement</span>
                </button>
              ))}
            </div>
          </div>

          {/* Team assignment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Team {isEdit && <span className="text-gray-400 font-normal">(change to transfer member)</span>}
            </label>
            <select className={sl} value={form.teamId} onChange={e => set('teamId', e.target.value)}>
              <option value="">— Unassigned —</option>
              {allTeams.map(t => (
                <option key={t.id} value={t.id}>{t.deptName} › {t.name}</option>
              ))}
            </select>
          </div>

          {/* Entitlement override */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Annual Entitlement (days)</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={form.customEnt} onChange={e => set('customEnt', e.target.checked)} />
                Override default
              </label>
            </div>
            <input type="number" className={sl} min={1} max={60}
              value={form.annualEntitlement}
              disabled={!form.customEnt}
              onChange={e => set('annualEntitlement', e.target.value)} />
            {!form.customEnt && (
              <p className="text-xs text-gray-400 mt-0.5">Auto-set by role: {entitlementForRole(form.role)} days</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={mut.isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
              {mut.isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Replace Roster Modal ────────────────────────────────────────────────────
function ReplaceRosterModal({ team, onClose }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  function parseRosterText(t) {
    return t.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const parts = l.split(/\s*[-–]\s*/);
      const name = parts[0].trim();
      const raw  = parts[1]?.trim().toLowerCase() || '';
      let role = 'staff';
      if (raw.includes('m spvr') || raw.includes('marshal')) role = 'm_supervisor';
      else if (raw.includes('spvr') || raw.includes('supervisor'))  role = 'supervisor';
      else if (raw.includes('maint'))                                role = 'maintenance';
      return { name, role };
    });
  }

  const preview = useMemo(() => parseRosterText(text), [text]);

  const mut = useMutation(({ teamId, members }) => leaveApi.replaceRoster(teamId, { members }), {
    onSuccess: res => {
      toast.success(`Roster replaced — ${res.data.replaced} member(s) set.`);
      qc.invalidateQueries('lms-staff');
      qc.invalidateQueries('lms-departments');
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const handleReplace = () => {
    if (!preview.length) return toast.error('Paste at least one name.');
    if (!window.confirm(`Replace all current members of "${team.name}" with ${preview.length} new member(s)?\n\nExisting leave records are preserved.`)) return;
    mut.mutate({ teamId: team.id, members: preview });
  };

  const ROLE_BADGE = { supervisor: 'Spvr', m_supervisor: 'M Spvr', maintenance: 'Maint', staff: 'Staff' };
  const ROLE_CLR   = { supervisor: 'purple', m_supervisor: 'blue', maintenance: 'teal', staff: 'gray' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Replace Roster — {team.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Current members will be deactivated. Leave records are preserved.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden px-6 py-4">
          {/* Input */}
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600">
              Paste roster — one name per line.<br />
              Add role after a dash: <code className="bg-gray-100 px-1 rounded">Name - Spvr</code><br />
              Role codes: <strong>Spvr</strong>, <strong>M Spvr</strong>, <strong>Maint</strong> (blank = Staff)
            </p>
            <textarea
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={12}
              placeholder={"Dennis Gardiner - Spvr\nMertz Matthew\nSitsope Cudjoe - Maint"}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          {/* Preview */}
          <div className="w-56 flex flex-col gap-2 shrink-0">
            <p className="text-xs font-medium text-gray-600">Preview ({preview.length} members)</p>
            <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto divide-y divide-gray-100">
              {preview.length === 0
                ? <p className="px-3 py-3 text-xs text-gray-400 italic">Start typing to preview…</p>
                : preview.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-gray-800 truncate flex-1 mr-2">{m.name}</span>
                    <Badge color={ROLE_CLR[m.role]}>{ROLE_BADGE[m.role]}</Badge>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleReplace} disabled={!preview.length || mut.isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
            {mut.isLoading ? 'Replacing…' : `Replace with ${preview.length} Member${preview.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────────────
function RosterTab() {
  const qc = useQueryClient();
  const { data: depts = [], isLoading } = useQuery('lms-departments', () => leaveApi.departments().then(r => r.data));
  const { data: allStaff = [] }         = useQuery('lms-staff',       () => leaveApi.staff().then(r => r.data));

  const [expanded, setExpanded]   = useState({});
  const [newDept, setNewDept]     = useState('');
  const [newTeams, setNewTeams]   = useState({});
  const [staffModal, setStaffModal]   = useState(null); // { staff?, teamId }
  const [replaceTeam, setReplaceTeam] = useState(null);
  const [search, setSearch]           = useState('');

  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // Flat list of all teams for the staff modal team selector
  const allTeams = useMemo(() => depts.flatMap(d =>
    (d.teams || []).map(t => ({ ...t, deptName: d.name }))
  ), [depts]);

  const staffByTeam = useMemo(() => {
    const map = {};
    allStaff.forEach(s => { if (!map[s.team_id]) map[s.team_id] = []; map[s.team_id].push(s); });
    return map;
  }, [allStaff]);

  // Cross-team search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allStaff.filter(s => s.name.toLowerCase().includes(q));
  }, [allStaff, search]);

  const ROLE_COLOR = { supervisor: 'purple', m_supervisor: 'blue', maintenance: 'teal', staff: 'gray' };
  const ROLE_ABBR  = { supervisor: 'Spvr', m_supervisor: 'M Spvr', maintenance: 'Maint. Officer', staff: 'Staff' };
  const AVATAR_BG  = { supervisor: 'bg-purple-500', m_supervisor: 'bg-blue-500', maintenance: 'bg-teal-500', staff: 'bg-gray-400' };

  const createDept = useMutation(() => leaveApi.createDept({ name: newDept }), {
    onSuccess: () => { setNewDept(''); qc.invalidateQueries('lms-departments'); toast.success('Department created.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const deleteDept = useMutation(id => leaveApi.deleteDept(id), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); toast.success('Department deleted.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const addTeam = useMutation(({ deptId, name }) => leaveApi.addTeam(deptId, { name }), {
    onSuccess: (_, { deptId }) => { setNewTeams(t => ({ ...t, [deptId]: '' })); qc.invalidateQueries('lms-departments'); toast.success('Team added.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const deleteTeam = useMutation(({ deptId, teamId }) => leaveApi.deleteTeam(deptId, teamId), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); qc.invalidateQueries('lms-staff'); toast.success('Team removed.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const removeStaff = useMutation(id => leaveApi.removeStaff(id), {
    onSuccess: () => { qc.invalidateQueries('lms-staff'); qc.invalidateQueries('lms-departments'); toast.success('Member removed.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="p-6 space-y-5">
      {/* Modals */}
      {staffModal && (
        <StaffModal
          staff={staffModal.staff || null}
          defaultTeamId={staffModal.teamId}
          allTeams={allTeams}
          onClose={() => setStaffModal(null)}
        />
      )}
      {replaceTeam && (
        <ReplaceRosterModal team={replaceTeam} onClose={() => setReplaceTeam(null)} />
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Search staff across all teams…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Add department */}
        <div className="flex gap-2 ml-auto">
          <input type="text" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"
            placeholder="New department name" value={newDept} onChange={e => setNewDept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newDept.trim() && createDept.mutate()} />
          <button onClick={() => newDept.trim() && createDept.mutate()}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            <Plus size={14} /> Add Dept
          </button>
        </div>
      </div>

      {/* Search results panel */}
      {search.trim() && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Search results — {searchResults.length} member{searchResults.length !== 1 ? 's' : ''} found
            </p>
          </div>
          {searchResults.length === 0
            ? <p className="px-4 py-3 text-sm text-gray-400">No staff matched "{search}".</p>
            : searchResults.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 border-gray-50 hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${AVATAR_BG[s.role]}`}>
                  {s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.team_name || 'Unassigned'} {s.dept_name ? `· ${s.dept_name}` : ''}</p>
                </div>
                <Badge color={ROLE_COLOR[s.role]}>{ROLE_ABBR[s.role]}</Badge>
                <span className="text-xs text-gray-400">{s.annual_entitlement}d</span>
                <button onClick={() => setStaffModal({ staff: s, teamId: s.team_id })}
                  className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg hover:bg-blue-50">
                  <Pencil size={13} />
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* Department / Team cards */}
      {depts.map(d => {
        const deptCount = (d.teams || []).reduce((s, t) => s + (t.member_count || 0), 0);
        return (
          <div key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Department header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => toggle(d.id)}>
              <div className="flex-1 flex items-center gap-3">
                <span className="font-bold text-gray-900">{d.name}</span>
                <Badge color="gray">{(d.teams || []).length} teams · {deptCount} staff</Badge>
              </div>
              <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete department "${d.name}" and all its teams?`)) deleteDept.mutate(d.id); }}
                className="p-1 text-red-200 hover:text-red-500 rounded" title="Delete department">
                <Trash2 size={14} />
              </button>
              {expanded[d.id]
                ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
            </div>

            {expanded[d.id] && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {/* Add team bar */}
                <div className="flex gap-2">
                  <input type="text"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="New team name…"
                    value={newTeams[d.id] || ''}
                    onChange={e => setNewTeams(t => ({ ...t, [d.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { const name = (newTeams[d.id]||'').trim(); if(name) addTeam.mutate({deptId: d.id, name}); }}} />
                  <button onClick={() => { const name = (newTeams[d.id]||'').trim(); if(name) addTeam.mutate({deptId: d.id, name}); }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg whitespace-nowrap">
                    + Add Team
                  </button>
                </div>

                {/* Teams */}
                {(d.teams || []).map(t => {
                  const members = staffByTeam[t.id] || [];
                  const roleBreakdown = ROLE_OPTIONS.map(r => ({
                    ...r, count: members.filter(m => m.role === r.value).length
                  })).filter(r => r.count > 0);

                  return (
                    <div key={t.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Team header */}
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50">
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                          <span className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                          {roleBreakdown.map(r => (
                            <Badge key={r.value} color={ROLE_COLOR[r.value]}>
                              {r.count} {ROLE_ABBR[r.value]}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1 items-center shrink-0">
                          <button onClick={() => setStaffModal({ staff: null, teamId: t.id })}
                            className="flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-1 rounded-lg">
                            <UserPlus size={12} /> Add
                          </button>
                          <button onClick={() => setReplaceTeam(t)}
                            className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg">
                            <Upload size={12} /> Bulk
                          </button>
                          <button onClick={() => { if (window.confirm(`Remove team "${t.name}"?`)) deleteTeam.mutate({ deptId: d.id, teamId: t.id }); }}
                            className="p-1 text-red-200 hover:text-red-400 rounded" title="Delete team">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Member rows */}
                      <div className="divide-y divide-gray-50">
                        {members.length === 0
                          ? (
                            <button onClick={() => setStaffModal({ staff: null, teamId: t.id })}
                              className="w-full flex items-center gap-2 px-4 py-3 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                              <Plus size={13} /> Click to add the first member
                            </button>
                          )
                          : members.map(s => (
                            <div key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors group">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${AVATAR_BG[s.role]}`}>
                                {s.name[0]}
                              </div>
                              <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                              <Badge color={ROLE_COLOR[s.role]}>{ROLE_ABBR[s.role]}</Badge>
                              <span className="text-xs text-gray-400 w-8 text-right">{s.annual_entitlement}d</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setStaffModal({ staff: s, teamId: s.team_id })}
                                  title="Edit member"
                                  className="p-1 text-gray-300 hover:text-blue-500 rounded">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => { if (window.confirm(`Remove ${s.name} from this team?`)) removeStaff.mutate(s.id); }}
                                  title="Remove member"
                                  className="p-1 text-gray-300 hover:text-red-400 rounded">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  );
                })}

                {!(d.teams || []).length && (
                  <p className="text-xs text-gray-400 italic px-1">No teams yet — add one above.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!depts.length && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No departments configured. Add one above to start building the roster.
        </div>
      )}
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
    onSuccess: () => qc.invalidateQueries('lms-holidays'),
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <div className="p-6 max-w-lg space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Public Holidays</h2>
        <p className="text-xs text-gray-500 mt-0.5">These dates are excluded from working-day calculations.</p>
      </div>
      <div className="flex gap-2">
        <input type="date" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <input type="text" placeholder="Holiday name"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && form.date && form.name && add.mutate()} />
        <button onClick={() => form.date && form.name && add.mutate()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg">
          <Plus size={16} />
        </button>
      </div>
      {isLoading ? <Spinner /> : (
        <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
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
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview',  icon: CalendarDays },
  { key: 'submit',   label: '+ Submit',  icon: Plus },
  { key: 'records',  label: 'Records',   icon: ClipboardList },
  { key: 'balances', label: 'Balances',  icon: Users },
  { key: 'roster',   label: 'Roster',    icon: Users,        adminOnly: true },
  { key: 'holidays', label: 'Holidays',  icon: CalendarDays, adminOnly: true },
];

export default function LeavePage() {
  const { hasRole } = useAuth();
  const isAdmin     = hasRole('admin');
  const isSupervisor = hasRole('supervisor');

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <ShieldOff size={48} className="text-gray-300" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">Leave Management is available to Supervisors and Admins only.</p>
      </div>
    );
  }

  const [tab, setTab] = useState('overview');
  const visibleTabs   = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0">
        <div className="flex items-center gap-3 mb-3">
          <CalendarDays size={20} className="text-blue-600" />
          <h1 className="text-base font-bold text-gray-900">Leave Management</h1>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{currentYear}</span>
        </div>
        <div className="flex gap-0.5 overflow-x-auto">
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {tab === 'overview'  && <OverviewTab />}
        {tab === 'submit'    && <SubmitTab />}
        {tab === 'records'   && <RecordsTab isAdmin={isAdmin} />}
        {tab === 'balances'  && <BalancesTab />}
        {tab === 'roster'    && isAdmin && <RosterTab />}
        {tab === 'holidays'  && isAdmin && <HolidaysTab />}
      </div>
    </div>
  );
}
