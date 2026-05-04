import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  CalendarDays, Users, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Trash2, UserPlus, ShieldOff,
  RefreshCw, ClipboardList, Upload,
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
  { value: 'staff',        label: 'Staff',                          ent: 18 },
  { value: 'supervisor',   label: 'Supervisor (Spvr)',              ent: 21 },
  { value: 'm_supervisor', label: "Marshal's Supervisor (M Spvr)", ent: 21 },
  { value: 'maintenance',  label: 'Maintenance Officer',            ent: 21 },
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
  // If start itself is a working day, count it as day 1
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

// ─── Shared components ────────────────────────────────────────────────────────
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

function statusBadge(s) {
  if (s === 'Approved') return <Badge color="green">✓ Approved</Badge>;
  if (s === 'Rejected') return <Badge color="red">✗ Rejected</Badge>;
  return <Badge color="amber">⏳ Pending</Badge>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const currentYear = new Date().getFullYear();

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading, refetch } = useQuery(
    'leave-overview',
    () => leaveApi.overview().then(r => r.data),
    { refetchInterval: 60000 }
  );

  if (isLoading) return <Spinner />;
  const { onLeave = [], pendingCount = 0, lowBalance = [] } = data || {};

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<CalendarDays size={20} className="text-blue-500" />}
          label="On Leave Today" value={onLeave.length} color="blue" />
        <StatCard icon={<Clock size={20} className="text-amber-500" />}
          label="Pending Manual Review" value={pendingCount} color="amber" />
        <StatCard icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Low Balances (≤5 days)" value={lowBalance.length} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Staff On Leave Today">
          {!onLeave.length
            ? <p className="text-sm text-gray-400 py-4 text-center">No one on leave today.</p>
            : onLeave.map(r => (
                <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0 border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.team} · Returns {fmtDate(r.end_date)}</p>
                  </div>
                  <Badge color="blue">{r.leave_type.replace(' Leave', '')}</Badge>
                </div>
              ))
          }
        </Card>

        <Card title="Low Leave Balances">
          {!lowBalance.length
            ? <p className="text-sm text-gray-400 py-4 text-center">All balances are healthy.</p>
            : lowBalance.map(s => {
                const remaining = s.annual_entitlement - s.used_current;
                const pct = Math.max(0, (remaining / s.annual_entitlement) * 100);
                return (
                  <div key={s.id} className="py-2 border-b last:border-0 border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <span className={`font-semibold ${remaining <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {remaining} days left
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{s.team}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
          }
        </Card>
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
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
}

// ─── Submit tab ───────────────────────────────────────────────────────────────
function SubmitTab() {
  const qc = useQueryClient();
  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const { data: holidays = [] } = useQuery('lms-holidays', () => leaveApi.holidays().then(r => r.data));

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    staffId: '',
    leaveType: 'Annual Leave',
    entitlementYear: currentYear,
    startDate: today,
    numDays: '',
    endDate: '',
    notes: '',
  });
  const [result, setResult] = useState(null); // { decision, clash_reason, ... }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isGift = GIFT_TYPES.includes(form.leaveType);

  // Auto-fill numDays for gift leave
  function handleTypeChange(lt) {
    let patch = { leaveType: lt };
    if (lt === 'Maternity Leave') patch.numDays = MATERNITY_WD;
    else if (lt === 'Paternity Leave') patch.numDays = PATERNITY_WD;
    const newForm = { ...form, ...patch };
    setForm(newForm);
    if (newForm.startDate && newForm.numDays) {
      set('endDate', addWorkingDays(newForm.startDate, parseInt(newForm.numDays), holidays));
    }
  }

  function handleStartChange(sd) {
    set('startDate', sd);
    if (form.numDays && parseInt(form.numDays) > 0) {
      set('endDate', addWorkingDays(sd, parseInt(form.numDays), holidays));
    }
  }

  function handleDaysChange(d) {
    set('numDays', d);
    const n = parseInt(d);
    if (form.startDate && n > 0) {
      set('endDate', addWorkingDays(form.startDate, n, holidays));
    } else {
      set('endDate', '');
    }
  }

  // Get balance info for selected staff
  const { data: staffBalance } = useQuery(
    ['lms-staff-balance', form.staffId, form.entitlementYear],
    () => leaveApi.balances({ year: form.entitlementYear }).then(r => r.data),
    { enabled: !!form.staffId, select: data => data.find(s => s.id === parseInt(form.staffId)) }
  );

  const mutation = useMutation(
    (d) => leaveApi.submit(d),
    {
      onSuccess: (res) => {
        setResult(res.data);
        if (res.data.decision === 'Approved') {
          toast.success('Leave approved — no clash detected.');
          setForm({ staffId: '', leaveType: 'Annual Leave', entitlementYear: currentYear, startDate: today, numDays: '', endDate: '', notes: '' });
        } else {
          toast.error('Leave rejected — clash detected.');
        }
        qc.invalidateQueries('leave-overview');
        qc.invalidateQueries('lms-requests');
        qc.invalidateQueries('lms-balances');
        qc.invalidateQueries('lms-staff-balance');
      },
      onError: (err) => {
        setResult({ decision: 'Error', clash_reason: err.response?.data?.error || 'Submission failed.' });
      },
    }
  );

  function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    if (!form.staffId) return toast.error('Please select a staff member.');
    const n = parseInt(form.numDays);
    if (!form.startDate || !n || n <= 0) return toast.error('Start date and number of days are required.');
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

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Submit Leave Request</h2>
      <p className="text-xs text-gray-500 mb-4">Leave is auto-approved if no team clash is detected.</p>

      {/* Decision result banner */}
      {result && (
        <div className={`mb-4 p-4 rounded-xl border ${
          result.decision === 'Approved'
            ? 'bg-green-50 border-green-200 text-green-800'
            : result.decision === 'Rejected'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold text-sm mb-1">
            {result.decision === 'Approved'
              ? <><CheckCircle size={16} /> Leave Approved</>
              : <><XCircle size={16} /> Leave Rejected</>
            }
          </div>
          {result.clash_reason && (
            <p className="text-xs mt-1">{result.clash_reason}</p>
          )}
          {result.decision === 'Approved' && (
            <p className="text-xs mt-1">
              {result.staff_name} · {result.leave_type} · {fmtDate(result.start_date)} – {fmtDate(result.end_date)} · {result.working_days} working days
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Staff */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Staff Member</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.staffId} onChange={e => { set('staffId', e.target.value); setResult(null); }} required>
            <option value="">— Select staff member —</option>
            {Object.entries(grouped).map(([group, members]) => (
              <optgroup key={group} label={group}>
                {members.map(s => <option key={s.id} value={s.id}>{s.name} ({roleLabel(s.role)})</option>)}
              </optgroup>
            ))}
          </select>

          {/* Balance preview */}
          {staffBalance && !isGift && form.leaveType === 'Annual Leave' && (
            <div className="mt-1.5 flex gap-3 text-xs text-gray-600">
              <span>Entitlement: <strong>{staffBalance.annual_entitlement}</strong></span>
              {staffBalance.carry_over > 0 && <span className="text-teal-600">+ Carry-over: <strong>{staffBalance.carry_over}</strong></span>}
              <span>Used: <strong>{staffBalance.used}</strong></span>
              <span className={staffBalance.remaining <= 5 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                Remaining: {staffBalance.remaining}
              </span>
            </div>
          )}
        </div>

        {/* Leave type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.leaveType} onChange={e => handleTypeChange(e.target.value)}>
            {LEAVE_TYPES.map(lt => <option key={lt}>{lt}</option>)}
          </select>
          {isGift && (
            <p className="mt-1 text-xs text-teal-600 font-medium">
              🎁 Gift leave — does not reduce annual balance.
              {form.leaveType === 'Maternity Leave' ? ` Standard: ${MATERNITY_WD} working days.` : ` Standard: ${PATERNITY_WD} working days.`}
            </p>
          )}
        </div>

        {/* Entitlement year (for carry-over) */}
        {!isGift && form.leaveType === 'Annual Leave' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Year of Leave Being Requested
              <span className="ml-1 text-gray-400 font-normal">(use previous year to draw carry-over)</span>
            </label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.entitlementYear} onChange={e => set('entitlementYear', parseInt(e.target.value))}>
              <option value={currentYear - 1}>{currentYear - 1} (carry-over)</option>
              <option value={currentYear}>{currentYear} (current year)</option>
            </select>
          </div>
        )}

        {/* Start date + days → end date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.startDate}
              onChange={e => handleStartChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Number of Days</label>
            <input type="number" min="1" max="365"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 10"
              value={form.numDays}
              disabled={form.leaveType === 'Maternity Leave' || form.leaveType === 'Paternity Leave'}
              onChange={e => handleDaysChange(e.target.value)} />
          </div>
        </div>

        {/* Predicted end date */}
        {form.endDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-blue-700">
                <strong>End date: {fmtDate(form.endDate)}</strong>
              </span>
              <span className="text-xs text-blue-500">
                {form.numDays} working day{form.numDays != 1 ? 's' : ''} · excl. weekends &amp; holidays
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-0.5">
              {fmtDate(form.startDate)} → {fmtDate(form.endDate)}
            </p>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <button type="submit" disabled={mutation.isLoading || !form.endDate}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          {mutation.isLoading ? 'Processing…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}

// ─── Records tab ──────────────────────────────────────────────────────────────
function RecordsTab({ isAdmin }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', year: currentYear, team: '' });
  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery(
    ['lms-requests', filters],
    () => leaveApi.requests({ ...filters, limit: 300 }).then(r => r.data)
  );

  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  const del = useMutation(id => leaveApi.deleteReq(id), {
    onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries('lms-requests'); },
    onError: e => toast.error(e.response?.data?.error || 'Delete failed.'),
  });

  const override = useMutation(({ id, action, reason }) =>
    action === 'approve' ? leaveApi.approve(id) : leaveApi.reject(id, { reason }),
    {
      onSuccess: (_, { action }) => {
        toast.success(action === 'approve' ? 'Overridden: Approved.' : 'Overridden: Rejected.');
        qc.invalidateQueries('lms-requests');
      },
      onError: e => toast.error(e.response?.data?.error || 'Override failed.'),
    }
  );

  const rows = data?.requests || [];

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        {[
          { label: 'Year', field: 'year', opts: [currentYear - 1, currentYear, currentYear + 1].map(y => ({ v: y, l: y })) },
          { label: 'Status', field: 'status', opts: [{ v: '', l: 'All' }, { v: 'Approved', l: 'Approved' }, { v: 'Rejected', l: 'Rejected' }, { v: 'Pending', l: 'Pending' }] },
        ].map(({ label, field, opts }) => (
          <div key={field}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              value={filters[field]} onChange={e => setF(field, e.target.value)}>
              {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
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
        ? <Spinner />
        : !rows.length
          ? <div className="text-center py-12 text-gray-400 text-sm">No records found.</div>
          : <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Staff', 'Team', 'Type', 'Ent. Year', 'Dates', 'Days', 'Status', 'Decision By', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.staff_name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.team_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs">{r.leave_type}</span>
                        {r.is_gift_leave && <span className="ml-1 text-teal-600">🎁</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">{r.entitlement_year || r.year}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                      </td>
                      <td className="px-3 py-2 font-medium text-center">{r.working_days}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {statusBadge(r.status)}
                        {r.auto_decision && <span className="ml-1 text-xs text-gray-400">auto</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {r.status === 'Approved' ? r.approved_by : r.rejected_by || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex gap-1">
                            {r.status !== 'Approved' && (
                              <button onClick={() => override.mutate({ id: r.id, action: 'approve' })}
                                title="Override: Approve"
                                className="text-green-400 hover:text-green-600"><CheckCircle size={14} /></button>
                            )}
                            {r.status !== 'Rejected' && (
                              <button onClick={() => { const reason = prompt('Reason for rejection (optional):'); override.mutate({ id: r.id, action: 'reject', reason }); }}
                                title="Override: Reject"
                                className="text-red-300 hover:text-red-500"><XCircle size={14} /></button>
                            )}
                            <button onClick={() => { if (window.confirm('Delete this record?')) del.mutate(r.id); }}
                              title="Delete" className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {/* Rejection reasons */}
      {rows.some(r => r.rejection_reason) && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejection Reasons</p>
          {rows.filter(r => r.rejection_reason).map(r => (
            <div key={r.id} className="text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="font-medium">{r.staff_name}</span> — {r.rejection_reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Balances tab ─────────────────────────────────────────────────────────────
function BalancesTab() {
  const [year, setYear]       = useState(currentYear);
  const [lowOnly, setLowOnly] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');

  const { data = [], isLoading } = useQuery(
    ['lms-balances', year, teamFilter],
    () => leaveApi.balances({ year, team: teamFilter || undefined }).then(r => r.data)
  );

  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));
  const teams = useMemo(() => [...new Set(allStaff.map(s => s.team_name).filter(Boolean))].sort(), [allStaff]);

  const filtered = lowOnly ? data.filter(s => s.remaining <= 7) : data;

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Team</label>
          <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-0.5">
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
          Low balance only (≤7 days)
        </label>
      </div>

      {isLoading
        ? <Spinner />
        : <div className="overflow-x-auto rounded-xl border border-gray-200">
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
                  const pct = Math.max(0, Math.min(100, (s.remaining / Math.max(1, s.total_budget)) * 100));
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
                      <td className="px-3 py-2 text-center text-amber-600 text-xs">{s.used}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold text-sm ${s.remaining <= 0 ? 'text-red-600' : s.remaining <= 5 ? 'text-amber-600' : 'text-gray-900'}`}>
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
            </table>
          </div>
      }
      <p className="text-xs text-gray-400 mt-3">
        * Carry-over = unused days from {year - 1}. Total = Entitlement + Carry-over. Remaining = Total – Used.
      </p>
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────────────
function RosterTab() {
  const qc = useQueryClient();
  const { data: depts = [], isLoading } = useQuery(
    'lms-departments',
    () => leaveApi.departments().then(r => r.data)
  );
  const { data: allStaff = [] } = useQuery('lms-staff', () => leaveApi.staff().then(r => r.data));

  const [expanded, setExpanded] = useState({});
  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const [newDept, setNewDept]   = useState('');
  const [newTeams, setNewTeams] = useState({});
  const [addMemberTeam, setAddMemberTeam] = useState(null);
  const [newMember, setNewMember]         = useState({ name: '', role: 'staff' });
  const [replaceTeam, setReplaceTeam]     = useState(null); // { id, name }
  const [rosterText, setRosterText]       = useState('');

  const staffByTeam = useMemo(() => {
    const map = {};
    allStaff.forEach(s => {
      if (!map[s.team_id]) map[s.team_id] = [];
      map[s.team_id].push(s);
    });
    return map;
  }, [allStaff]);

  const createDept = useMutation(() => leaveApi.createDept({ name: newDept }), {
    onSuccess: () => { setNewDept(''); qc.invalidateQueries('lms-departments'); toast.success('Department created.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const deleteDept = useMutation(id => leaveApi.deleteDept(id), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); toast.success('Deleted.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const addTeam = useMutation(({ deptId, name }) => leaveApi.addTeam(deptId, { name }), {
    onSuccess: (_, { deptId }) => { setNewTeams(t => ({ ...t, [deptId]: '' })); qc.invalidateQueries('lms-departments'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const deleteTeam = useMutation(({ deptId, teamId }) => leaveApi.deleteTeam(deptId, teamId), {
    onSuccess: () => { qc.invalidateQueries('lms-departments'); qc.invalidateQueries('lms-staff'); toast.success('Team removed.'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  const addStaff = useMutation(
    ({ teamId }) => leaveApi.addStaff({ teamId, name: newMember.name, role: newMember.role }),
    {
      onSuccess: () => { setAddMemberTeam(null); setNewMember({ name: '', role: 'staff' }); qc.invalidateQueries('lms-staff'); qc.invalidateQueries('lms-departments'); toast.success('Member added.'); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const removeStaff = useMutation(id => leaveApi.removeStaff(id), {
    onSuccess: () => { qc.invalidateQueries('lms-staff'); qc.invalidateQueries('lms-departments'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  // Monthly roster replacement
  const replaceRoster = useMutation(
    ({ teamId, members }) => leaveApi.replaceRoster(teamId, { members }),
    {
      onSuccess: (res) => {
        toast.success(`Roster updated — ${res.data.replaced} member(s) added.`);
        setReplaceTeam(null); setRosterText('');
        qc.invalidateQueries('lms-staff'); qc.invalidateQueries('lms-departments');
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  // Parse pasted roster text
  // Format: "Name - Role" per line. Role optional (defaults to staff).
  // Recognized role abbreviations: Spvr, M Spvr, Maint
  function parseRosterText(text) {
    return text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => {
        const parts = l.split(/\s*[-–]\s*/);
        const name = parts[0].trim();
        const rawRole = parts[1]?.trim().toLowerCase() || '';
        let role = 'staff';
        if (rawRole.includes('m spvr') || rawRole.includes('m_spvr') || rawRole.includes('marshal')) role = 'm_supervisor';
        else if (rawRole.includes('spvr') || rawRole.includes('supervisor')) role = 'supervisor';
        else if (rawRole.includes('maint') || rawRole.includes('maintenance')) role = 'maintenance';
        return { name, role };
      });
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="p-6 space-y-5">
      {/* Roster replacement modal */}
      {replaceTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">Replace Roster — {replaceTeam.name}</h3>
            <p className="text-xs text-gray-500 mb-3">
              Paste one member per line. Format: <code className="bg-gray-100 px-1 rounded">Name - Role</code><br />
              Roles: <strong>Spvr</strong>, <strong>M Spvr</strong>, <strong>Maint</strong>, or leave blank for Staff.<br />
              Current members will be deactivated. Leave history is preserved.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              rows={10}
              placeholder={"Dennis Gardiner - Spvr\nMertz Matthew\nSitsope Cudjoe"}
              value={rosterText}
              onChange={e => setRosterText(e.target.value)}
            />
            {rosterText && (
              <div className="mt-2 text-xs text-gray-500">
                Preview: {parseRosterText(rosterText).length} member(s)
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const members = parseRosterText(rosterText);
                  if (!members.length) return toast.error('No valid members found.');
                  if (!window.confirm(`Replace all current members of "${replaceTeam.name}" with ${members.length} new member(s)?`)) return;
                  replaceRoster.mutate({ teamId: replaceTeam.id, members });
                }}
                disabled={replaceRoster.isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg">
                {replaceRoster.isLoading ? 'Updating…' : 'Replace Roster'}
              </button>
              <button onClick={() => { setReplaceTeam(null); setRosterText(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add department */}
      <Card title="Add Department">
        <div className="flex gap-2">
          <input type="text" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder="Department name" value={newDept} onChange={e => setNewDept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newDept.trim() && createDept.mutate()} />
          <button onClick={() => newDept.trim() && createDept.mutate()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg">Create</button>
        </div>
      </Card>

      {/* Departments */}
      {depts.map(d => (
        <div key={d.id} className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
            onClick={() => toggle(d.id)}>
            <span className="font-semibold text-sm text-gray-900">{d.name}</span>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${d.name}" and all its teams?`)) deleteDept.mutate(d.id); }}
                className="text-red-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              {expanded[d.id] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </div>

          {expanded[d.id] && (
            <div className="border-t border-gray-100 p-4 space-y-4">
              {/* Add team row */}
              <div className="flex gap-2">
                <input type="text" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="New team name"
                  value={newTeams[d.id] || ''}
                  onChange={e => setNewTeams(t => ({ ...t, [d.id]: e.target.value }))} />
                <button onClick={() => { const name = (newTeams[d.id] || '').trim(); if (name) addTeam.mutate({ deptId: d.id, name }); }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">
                  + Add Team
                </button>
              </div>

              {/* Teams */}
              {(d.teams || []).map(t => (
                <div key={t.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Team header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      <Badge color="gray">{t.member_count} members</Badge>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => { setReplaceTeam({ id: t.id, name: t.name }); setRosterText(''); }}
                        title="Replace full roster (monthly update)"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
                        <Upload size={12} /> Replace Roster
                      </button>
                      <button onClick={() => setAddMemberTeam(addMemberTeam === t.id ? null : t.id)}
                        className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50">
                        <UserPlus size={12} /> Add Member
                      </button>
                      <button onClick={() => { if (window.confirm(`Remove team "${t.name}"?`)) deleteTeam.mutate({ deptId: d.id, teamId: t.id }); }}
                        className="text-red-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Add member form */}
                  {addMemberTeam === t.id && (
                    <div className="px-3 py-2 border-b border-gray-100 bg-green-50 flex gap-2 flex-wrap">
                      <input type="text" placeholder="Full name"
                        className="flex-1 min-w-[150px] border border-gray-300 rounded px-2 py-1.5 text-xs"
                        value={newMember.name} onChange={e => setNewMember(m => ({ ...m, name: e.target.value }))} />
                      <select className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                        value={newMember.role} onChange={e => setNewMember(m => ({ ...m, role: e.target.value }))}>
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.ent} days)</option>)}
                      </select>
                      <button onClick={() => newMember.name.trim() && addStaff.mutate({ teamId: t.id })}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Add</button>
                      <button onClick={() => setAddMemberTeam(null)}
                        className="text-xs text-gray-500 px-2 py-1.5 rounded hover:bg-gray-100">Cancel</button>
                    </div>
                  )}

                  {/* Members list */}
                  <div className="divide-y divide-gray-100">
                    {(staffByTeam[t.id] || []).map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-900">{s.name}</span>
                          <Badge color={
                            s.role === 'supervisor' ? 'purple' :
                            s.role === 'm_supervisor' ? 'blue' :
                            s.role === 'maintenance' ? 'teal' : 'gray'
                          }>
                            {s.role === 'supervisor' ? 'Spvr' :
                             s.role === 'm_supervisor' ? 'M Spvr' :
                             s.role === 'maintenance' ? 'Maint. Officer' : 'Staff'}
                          </Badge>
                          <span className="text-xs text-gray-400">{s.annual_entitlement}d</span>
                        </div>
                        <button onClick={() => { if (window.confirm(`Remove ${s.name} from the roster?`)) removeStaff.mutate(s.id); }}
                          className="text-red-200 hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {!(staffByTeam[t.id] || []).length && (
                      <p className="px-3 py-2 text-xs text-gray-400 italic">No active members</p>
                    )}
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
    onSuccess: () => qc.invalidateQueries('lms-holidays'),
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <div className="p-6 max-w-lg space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Public Holidays</h2>
        <p className="text-xs text-gray-500 mt-0.5">Holidays are excluded from working-day calculations.</p>
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
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
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

      {/* Tab content */}
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
