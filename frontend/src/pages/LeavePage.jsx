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

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
const LEAVE_COLORS = {
  'Annual Leave':        { chip: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
  'Sick Leave':          { chip: 'bg-red-100 text-red-700 border-red-200',      dot: 'bg-red-500' },
  'Compassionate Leave': { chip: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  'Maternity Leave':     { chip: 'bg-pink-100 text-pink-700 border-pink-200',   dot: 'bg-pink-500' },
  'Paternity Leave':     { chip: 'bg-teal-100 text-teal-700 border-teal-200',   dot: 'bg-teal-500' },
};
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW_LABELS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function CalendarTab() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [teamFilter, setTeamFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  const monthStr = `${year}-${String(month).padStart(2,'0')}`;
  const todayStr = now.toISOString().slice(0,10);

  const { data, isLoading } = useQuery(
    ['lms-calendar', monthStr],
    () => leaveApi.calendar({ month: monthStr }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  // Navigate months
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1); } else setMonth(m => m+1); };
  const goToday   = () => { setYear(now.getFullYear()); setMonth(now.getMonth()+1); setSelectedDay(null); };

  // Build day → records map
  const dayMap = useMemo(() => {
    if (!data?.records) return {};
    const map = {};
    const firstDay = new Date(year, month-1, 1);
    const lastDay  = new Date(year, month, 0);

    data.records.forEach(r => {
      if (teamFilter && r.team_name !== teamFilter) return;
      if (typeFilter && r.leave_type !== typeFilter) return;
      const s = new Date(Math.max(new Date(r.start_date+'T00:00:00'), firstDay));
      const e = new Date(Math.min(new Date(r.end_date+'T00:00:00'), lastDay));
      for (const d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
        const k = d.toISOString().slice(0,10);
        if (!map[k]) map[k] = [];
        map[k].push(r);
      }
    });
    return map;
  }, [data, teamFilter, typeFilter, year, month]);

  // Build holiday map
  const holidayMap = useMemo(() => {
    const m = {};
    (data?.holidays || []).forEach(h => { m[h.date.slice(0,10)] = h.name; });
    return m;
  }, [data]);

  // Calendar grid: array of weeks (each 7 slots, null = padding)
  const weeks = useMemo(() => {
    const first   = new Date(year, month-1, 1);
    const total   = new Date(year, month, 0).getDate();
    const startDow = (first.getDay() + 6) % 7; // Mon=0
    const days = [...Array(startDow).fill(null), ...Array.from({length: total}, (_,i) => i+1)];
    while (days.length % 7) days.push(null);
    const w = [];
    for (let i=0; i<days.length; i+=7) w.push(days.slice(i,i+7));
    return w;
  }, [year, month]);

  // Monthly summary
  const summary = useMemo(() => {
    const counts = {};
    (data?.records || []).forEach(r => {
      if (teamFilter && r.team_name !== teamFilter) return;
      if (typeFilter && r.leave_type !== typeFilter) return;
      counts[r.leave_type] = (counts[r.leave_type]||0) + 1;
    });
    return counts;
  }, [data, teamFilter, typeFilter]);

  const selectedEntries = selectedDay ? (dayMap[selectedDay] || []) : [];
  const fSel = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronDown size={14} className="rotate-90" />
          </button>
          <span className="text-base font-bold text-gray-900 w-36 text-center">
            {MONTH_NAMES[month-1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronDown size={14} className="-rotate-90" />
          </button>
          <button onClick={goToday} className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg ml-1">
            Today
          </button>
        </div>

        {/* Filters */}
        <select className={fSel} value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setSelectedDay(null); }}>
          <option value="">All teams</option>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className={fSel} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setSelectedDay(null); }}>
          <option value="">All leave types</option>
          {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {Object.entries(LEAVE_COLORS).map(([type, { dot }]) => (
            <span key={type} className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              {type.replace(' Leave','')}
            </span>
          ))}
        </div>
      </div>

      {/* Monthly summary bar */}
      {Object.keys(summary).length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-500 flex-wrap">
          <span className="font-semibold text-gray-700">
            {Object.values(summary).reduce((a,b)=>a+b,0)} leave instance{Object.values(summary).reduce((a,b)=>a+b,0)!==1?'s':''} this month
          </span>
          {Object.entries(summary).map(([type, count]) => {
            const { dot } = LEAVE_COLORS[type] || { dot: 'bg-gray-400' };
            return (
              <span key={type} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                {type.replace(' Leave','')}: <strong className="text-gray-700">{count}</strong>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW_LABELS.map(d => (
              <div key={d} className={`py-2 text-center text-xs font-semibold ${d==='Sat'||d==='Sun' ? 'text-gray-400' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {isLoading ? <div className="py-16 text-center text-sm text-gray-400">Loading…</div> : (
            <div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-0 border-gray-100">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="bg-gray-50/50 min-h-[80px] border-r last:border-0 border-gray-100" />;

                    const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const entries  = dayMap[dateStr] || [];
                    const isToday  = dateStr === todayStr;
                    const holiday  = holidayMap[dateStr];
                    const isWeekend = di >= 5; // Sat/Sun
                    const isSelected = selectedDay === dateStr;
                    const show     = entries.slice(0, 2);
                    const overflow = entries.length - show.length;

                    return (
                      <div key={di}
                        onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                        className={`min-h-[80px] p-1.5 border-r last:border-0 border-gray-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' :
                          isWeekend  ? 'bg-gray-50/40 hover:bg-gray-50' : 'hover:bg-gray-50'
                        }`}>
                        {/* Date number */}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-blue-600 text-white' : isWeekend ? 'text-gray-400' : 'text-gray-700'
                          }`}>{day}</span>
                          {holiday && <span className="text-xs text-amber-600" title={holiday}>🎌</span>}
                        </div>
                        {/* Holiday label */}
                        {holiday && (
                          <p className="text-xs text-amber-600 truncate leading-tight mb-0.5" title={holiday}>{holiday}</p>
                        )}
                        {/* Leave chips */}
                        <div className="space-y-0.5">
                          {show.map((r, i) => {
                            const { chip } = LEAVE_COLORS[r.leave_type] || { chip: 'bg-gray-100 text-gray-600 border-gray-200' };
                            return (
                              <div key={i} className={`text-xs px-1.5 py-0.5 rounded border truncate leading-tight ${chip}`}
                                title={`${r.staff_name} — ${r.leave_type}`}>
                                {r.staff_name.split(' ')[0]}
                              </div>
                            );
                          })}
                          {overflow > 0 && (
                            <div className="text-xs text-gray-400 pl-1">+{overflow} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {new Date(selectedDay+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
                </p>
                {holidayMap[selectedDay] && (
                  <p className="text-xs text-amber-600 mt-0.5">🎌 {holidayMap[selectedDay]}</p>
                )}
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-gray-300 hover:text-gray-500">
                <X size={15} />
              </button>
            </div>

            {selectedEntries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No approved leave on this day.</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {selectedEntries.map((r, i) => {
                  const { chip, dot } = LEAVE_COLORS[r.leave_type] || { chip:'bg-gray-100 text-gray-600 border-gray-200', dot:'bg-gray-400' };
                  return (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.staff_name}</p>
                        <p className="text-xs text-gray-400 truncate">{r.team_name || 'Unassigned'}</p>
                        <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded border ${chip}`}>
                          {r.leave_type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                <strong className="text-gray-700">{selectedEntries.length}</strong> person{selectedEntries.length!==1?'s':''} on leave
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shift Schedule Tab ───────────────────────────────────────────────────────
const SHIFT_META = {
  days_exp:   { label: 'Days · Exp',    short: 'D-E', bg: 'bg-sky-100',    text: 'text-sky-800',   border: 'border-sky-200'   },
  days_imp:   { label: 'Days · Imp',    short: 'D-I', bg: 'bg-blue-100',   text: 'text-blue-800',  border: 'border-blue-200'  },
  days_int:   { label: 'Days · Int',    short: 'D-N', bg: 'bg-cyan-100',   text: 'text-cyan-800',  border: 'border-cyan-200'  },
  days:       { label: 'Days',          short: 'D',   bg: 'bg-teal-100',   text: 'text-teal-800',  border: 'border-teal-200'  },
  nights_exp: { label: 'Nights · Exp',  short: 'N-E', bg: 'bg-indigo-100', text: 'text-indigo-800',border: 'border-indigo-200'},
  nights_imp: { label: 'Nights · Imp',  short: 'N-I', bg: 'bg-violet-100', text: 'text-violet-800',border: 'border-violet-200'},
  nights_int: { label: 'Nights · Int',  short: 'N-N', bg: 'bg-purple-100', text: 'text-purple-800',border: 'border-purple-200'},
  nights:     { label: 'Nights',        short: 'N',   bg: 'bg-slate-200',  text: 'text-slate-700', border: 'border-slate-300' },
  rest:       { label: 'Rest Day',      short: 'R',   bg: 'bg-gray-100',   text: 'text-gray-400',  border: 'border-gray-200'  },
  flexi:      { label: 'FLEXI',         short: 'F',   bg: 'bg-amber-100',  text: 'text-amber-700', border: 'border-amber-200' },
};

function parseRosterPaste(text, staffList) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    // Try tab first, then comma
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 2) continue;
    // Name may include role suffix like "- (Spvr)" or "(M Spvr)" — strip it
    const rawName = parts[0].replace(/\s*[-–]\s*\(.*?\)\s*$/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    if (!rawName) continue;
    // Find matching staff (case-insensitive, partial OK)
    const match = staffList.find(s =>
      s.name.toLowerCase() === rawName.toLowerCase() ||
      s.name.toLowerCase().includes(rawName.toLowerCase()) ||
      rawName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0].toLowerCase())
    );
    if (!match) { results.push({ rawName, staffId: null, shifts: parts.slice(1), unmatched: true }); continue; }
    results.push({ rawName, staffId: match.id, staffName: match.name, shifts: parts.slice(1), unmatched: false });
  }
  return results;
}

function ShiftImportModal({ teamId, teamName, month, staffList, onClose }) {
  const qc = useQueryClient();
  const [text, setText]       = useState('');
  const [preview, setPreview] = useState([]);

  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    return parseRosterPaste(text, staffList);
  }, [text, staffList]);

  const matched   = parsed.filter(p => !p.unmatched);
  const unmatched = parsed.filter(p => p.unmatched);

  const mut = useMutation(d => leaveApi.importShifts(d), {
    onSuccess: res => {
      toast.success(`Shift schedule imported — ${res.data.inserted} entries saved.`);
      qc.invalidateQueries(['lms-shifts']);
      onClose();
    },
    onError: e => toast.error(e.response?.data?.error || 'Import failed.'),
  });

  const handleImport = () => {
    if (!matched.length) return toast.error('No matched staff found.');
    mut.mutate({
      month,
      teamId,
      entries: matched.map(p => ({ staffId: p.staffId, shifts: p.shifts })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Import Shift Schedule — {teamName}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{MONTH_NAMES[parseInt(month.split('-')[1])-1]} {month.split('-')[0]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden px-6 py-4">
          {/* Paste area */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <p className="text-xs text-gray-500">
              Copy shift data from the roster spreadsheet and paste below.<br />
              <strong>Format:</strong> one person per line, tab- or comma-separated.<br />
              <code className="bg-gray-100 px-1 rounded text-xs">Name [tab] Day1 [tab] Day2 … Day30</code><br />
              Role suffixes like <code className="bg-gray-100 px-1 rounded text-xs">- (Spvr)</code> are stripped automatically.
            </p>
            <textarea
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={14}
              placeholder={"Dennis Gardiner - (Spvr)\tRest Day\tRest Day\tNights - Exp\tNights - Exp...\nMertz Matthew\tRest Day\tRest Day\tNights - Exp..."}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          {/* Preview */}
          <div className="w-60 flex flex-col gap-2 shrink-0">
            <p className="text-xs font-medium text-gray-600">
              Preview — {matched.length} matched, {unmatched.length} unmatched
            </p>
            <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto divide-y divide-gray-100 text-xs">
              {parsed.length === 0
                ? <p className="p-3 text-gray-400 italic">Paste roster to preview…</p>
                : parsed.map((p, i) => (
                  <div key={i} className={`px-3 py-2 flex items-center gap-2 ${p.unmatched ? 'bg-red-50' : ''}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.unmatched ? 'bg-red-400' : 'bg-green-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`truncate font-medium ${p.unmatched ? 'text-red-600' : 'text-gray-800'}`}>{p.rawName}</p>
                      {p.unmatched
                        ? <p className="text-red-400">Not found in roster</p>
                        : <p className="text-gray-400">{p.staffName} · {p.shifts.length} days</p>}
                    </div>
                  </div>
                ))}
            </div>
            {unmatched.length > 0 && (
              <p className="text-xs text-red-500">
                Unmatched names won't be imported. Check spelling against the roster.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleImport} disabled={!matched.length || mut.isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
            {mut.isLoading ? 'Importing…' : `Import ${matched.length} Staff`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShiftsTab() {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [teamId, setTeamId] = useState('');
  const [showImport, setShowImport] = useState(false);

  const monthStr = `${year}-${String(month).padStart(2,'0')}`;
  const todayStr = now.toISOString().slice(0,10);

  const prevMonth = () => { if (month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1); };

  // Department/team tree
  const { data: depts = [] } = useQuery('lms-departments', () => leaveApi.departments().then(r => r.data));
  const allTeams = useMemo(() => depts.flatMap(d => (d.teams||[]).map(t => ({...t, deptName: d.name}))), [depts]);
  const selectedTeam = allTeams.find(t => String(t.id) === String(teamId));

  // Staff in selected team
  const { data: teamStaff = [] } = useQuery(
    ['lms-staff', teamId],
    () => leaveApi.staff({ teamId }).then(r => r.data),
    { enabled: !!teamId }
  );

  // Shifts
  const { data: shiftData, isLoading: shiftsLoading } = useQuery(
    ['lms-shifts', monthStr, teamId],
    () => leaveApi.shifts({ month: monthStr, teamId }).then(r => r.data),
    { enabled: !!teamId }
  );

  // Approved leave for this team/month
  const { data: calData } = useQuery(
    ['lms-calendar', monthStr],
    () => leaveApi.calendar({ month: monthStr }).then(r => r.data),
    { enabled: !!teamId }
  );

  // Build shift map: { staffId → { "YYYY-MM-DD" → shiftType } }
  const shiftMap = useMemo(() => {
    const m = {};
    (shiftData?.rows || []).forEach(r => {
      if (!m[r.staff_id]) m[r.staff_id] = {};
      m[r.staff_id][r.shift_date] = r.shift_type;
    });
    return m;
  }, [shiftData]);

  // Build leave map: { staffName → Set of date strings on leave }
  const leaveMap = useMemo(() => {
    const m = {};
    if (!calData?.records) return m;
    calData.records.forEach(r => {
      if (!m[r.staff_name]) m[r.staff_name] = new Set();
      const s = new Date(r.start_date+'T00:00:00');
      const e = new Date(r.end_date+'T00:00:00');
      for (const d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
        m[r.staff_name].add(d.toISOString().slice(0,10));
      }
    });
    return m;
  }, [calData]);

  // Day columns for the month
  const days = useMemo(() => {
    const total = new Date(year, month, 0).getDate();
    return Array.from({length: total}, (_, i) => {
      const d = i + 1;
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(ds+'T00:00:00').getDay(); // 0=Sun
      return { day: d, dateStr: ds, dow };
    });
  }, [year, month]);

  const DOW_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const qc = useQueryClient();
  const clearMut = useMutation(() => leaveApi.clearShifts({ month: monthStr, teamId }), {
    onSuccess: r => { toast.success(`${r.data.deleted} shift entries cleared.`); qc.invalidateQueries(['lms-shifts']); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const fSel = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="p-4 md:p-6 space-y-4">
      {showImport && selectedTeam && (
        <ShiftImportModal
          teamId={parseInt(teamId)}
          teamName={selectedTeam.name}
          month={monthStr}
          staffList={teamStaff}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronDown size={14} className="rotate-90" />
          </button>
          <span className="text-base font-bold text-gray-900 w-36 text-center">
            {MONTH_NAMES[month-1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronDown size={14} className="-rotate-90" />
          </button>
        </div>

        {/* Team selector */}
        <select className={fSel + ' w-56'} value={teamId} onChange={e => setTeamId(e.target.value)}>
          <option value="">— Select a team —</option>
          {depts.map(d => (
            <optgroup key={d.id} label={d.name}>
              {(d.teams||[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Actions */}
        {teamId && (
          <>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg">
              <Upload size={13} /> Import Shifts
            </button>
            <button onClick={() => { if (window.confirm(`Clear all shift data for ${selectedTeam?.name} in ${MONTH_NAMES[month-1]} ${year}?`)) clearMut.mutate(); }}
              className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-lg">
              <Trash2 size={13} /> Clear Month
            </button>
          </>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {[['days_exp','Days·Exp'],['nights_exp','Nights·Exp'],['rest','Rest'],['flexi','FLEXI']].map(([k,l]) => {
            const { bg, text } = SHIFT_META[k];
            return <span key={k} className={`text-xs px-2 py-0.5 rounded font-medium ${bg} ${text}`}>{l}</span>;
          })}
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">On Leave</span>
        </div>
      </div>

      {!teamId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a team above to view their shift schedule.</div>
      ) : shiftsLoading ? (
        <Spinner />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: `${180 + days.length * 42}px` }}>
              <thead>
                {/* Day number row */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 border-r border-gray-200 w-44 min-w-[176px]">
                    Staff Member
                  </th>
                  {days.map(({ day, dateStr, dow }) => {
                    const isToday   = dateStr === todayStr;
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <th key={dateStr}
                        className={`w-10 min-w-[40px] py-1.5 text-center border-r last:border-0 border-gray-100 ${
                          isToday ? 'bg-blue-100' : isWeekend ? 'bg-gray-100' : ''
                        }`}>
                        <div className={`font-bold ${isToday ? 'text-blue-700' : isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>{day}</div>
                        <div className={`text-gray-400 font-normal ${isWeekend ? 'text-gray-300' : ''}`}>{DOW_SHORT[dow]}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamStaff.length === 0 ? (
                  <tr><td colSpan={days.length + 1} className="text-center py-8 text-gray-400">No staff in this team.</td></tr>
                ) : teamStaff.map(staff => {
                  const staffShifts = shiftMap[staff.id] || {};
                  const onLeaveDays = leaveMap[staff.name] || new Set();
                  const isSupervisor = staff.role === 'supervisor' || staff.role === 'm_supervisor';
                  return (
                    <tr key={staff.id} className={`hover:bg-gray-50/50 ${isSupervisor ? 'bg-amber-50/30' : ''}`}>
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-gray-200 font-medium text-gray-800 whitespace-nowrap"
                        style={{ background: isSupervisor ? '#fffbeb' : 'white' }}>
                        <div className="flex items-center gap-1.5">
                          {isSupervisor && <span className="text-amber-500 text-xs">⭐</span>}
                          <span className="truncate max-w-[150px]" title={staff.name}>{staff.name}</span>
                        </div>
                      </td>
                      {days.map(({ day, dateStr, dow }) => {
                        const isOnLeave = onLeaveDays.has(dateStr);
                        const shiftType = staffShifts[dateStr];
                        const isToday   = dateStr === todayStr;
                        const isWeekend = dow === 0 || dow === 6;

                        if (isOnLeave) {
                          return (
                            <td key={dateStr} title="On Leave"
                              className={`border-r last:border-0 border-gray-100 p-0.5 text-center ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''}`}>
                              <span className="block w-full text-center text-xs font-semibold bg-red-100 text-red-600 border border-red-200 rounded px-0.5 py-0.5">L</span>
                            </td>
                          );
                        }
                        if (!shiftType) {
                          return (
                            <td key={dateStr}
                              className={`border-r last:border-0 border-gray-100 p-0.5 text-center ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''}`}>
                              <span className="block text-gray-200">—</span>
                            </td>
                          );
                        }
                        const { short, bg, text, border } = SHIFT_META[shiftType] || SHIFT_META.rest;
                        return (
                          <td key={dateStr} title={SHIFT_META[shiftType]?.label}
                            className={`border-r last:border-0 border-gray-100 p-0.5 ${isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : ''}`}>
                            <span className={`block text-center text-xs font-semibold rounded px-0.5 py-0.5 border ${bg} ${text} ${border}`}>{short}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Shift legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1.5">
            {Object.entries(SHIFT_META).map(([k, { label, short, bg, text }]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${bg} ${text}`}>{short}</span>
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-red-100 text-red-600">L</span>
              On Leave
            </span>
          </div>
        </div>
      )}
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
  { key: 'overview',  label: 'Overview',  icon: CalendarDays },
  { key: 'calendar',  label: 'Calendar',  icon: CalendarDays },
  { key: 'shifts',    label: 'Shifts',    icon: ClipboardList },
  { key: 'submit',    label: '+ Submit',  icon: Plus },
  { key: 'records',   label: 'Records',   icon: ClipboardList },
  { key: 'balances',  label: 'Balances',  icon: Users },
  { key: 'roster',    label: 'Roster',    icon: Users,        adminOnly: true },
  { key: 'holidays',  label: 'Holidays',  icon: CalendarDays, adminOnly: true },
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
        {tab === 'calendar'  && <CalendarTab />}
        {tab === 'shifts'    && <ShiftsTab />}
        {tab === 'submit'    && <SubmitTab />}
        {tab === 'records'   && <RecordsTab isAdmin={isAdmin} />}
        {tab === 'balances'  && <BalancesTab />}
        {tab === 'roster'    && isAdmin && <RosterTab />}
        {tab === 'holidays'  && isAdmin && <HolidaysTab />}
      </div>
    </div>
  );
}
