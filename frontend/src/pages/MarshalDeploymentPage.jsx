import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { marshalApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Users, MapPin, Sun, Moon, Plus, X, ChevronDown,
  Clock, AlertTriangle, CheckCircle, XCircle, Minus,
  ClipboardList, BarChart2, RefreshCw, Trash2, Lock,
  UserCheck, Timer, ChevronRight,
} from 'lucide-react';

const AREAS   = ['IMPORTS', 'EXPORTS', 'INTRUSIVE'];
const SHIFTS  = ['DAY', 'NIGHT'];
const STATUS_CFG = {
  pending:  { label: 'Pending',  color: 'bg-gray-100 text-gray-500  border-gray-200',  dot: 'bg-gray-400'   },
  present:  { label: 'Present',  color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500'  },
  absent:   { label: 'Absent',   color: 'bg-red-50   text-red-700   border-red-200',   dot: 'bg-red-500'    },
  late:     { label: 'Late',     color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
};
const AREA_CFG = {
  IMPORTS:  { icon: '🚢', bg: 'bg-blue-600',   light: 'bg-blue-50',   border: 'border-blue-200'  },
  EXPORTS:  { icon: '📦', bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200' },
  INTRUSIVE:{ icon: '🔍', bg: 'bg-purple-600',  light: 'bg-purple-50', border: 'border-purple-200' },
};
const GANG_COLOR = {
  blue:  { ring: 'ring-blue-400',   badge: 'bg-blue-100 text-blue-800'   },
  slate: { ring: 'ring-slate-400',  badge: 'bg-slate-100 text-slate-800' },
  red:   { ring: 'ring-red-400',    badge: 'bg-red-100 text-red-800'     },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function today() { return format(new Date(), 'yyyy-MM-dd'); }

function SummaryPill({ present, total }) {
  const pct = total ? Math.round((present / total) * 100) : 0;
  const color = pct === 100 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-600';
  return (
    <span className={clsx('text-xs font-bold', color)}>
      {present}/{total} present
    </span>
  );
}

// ── Marshal Card ──────────────────────────────────────────────────────────────
function MarshalCard({ att, onToggle, isClosed, isOT }) {
  const cfg   = STATUS_CFG[att.status] || STATUS_CFG.pending;
  const role  = att.role === 'headman' ? 'HM' : att.role === 'foreman' ? 'FM' : null;

  return (
    <button
      onClick={() => !isClosed && onToggle(att.id)}
      disabled={isClosed}
      className={clsx(
        'flex items-center gap-2 w-full rounded-xl border px-3 py-2 text-left transition-all',
        cfg.color,
        !isClosed && 'hover:shadow-sm active:scale-[.98] cursor-pointer',
        isClosed && 'opacity-75 cursor-default'
      )}
    >
      <span className="shrink-0 w-6 h-6 rounded-full bg-white/60 text-xs font-bold flex items-center justify-center text-gray-600">
        {att.position_no}
      </span>
      <span className="flex-1 text-xs font-medium leading-tight truncate">
        {att.full_name}
      </span>
      {role && (
        <span className="shrink-0 text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full">
          {role}
        </span>
      )}
      {isOT && (
        <span className="shrink-0 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <Timer size={9} /> OT
        </span>
      )}
      <span className={clsx('shrink-0 w-2 h-2 rounded-full', cfg.dot)} />
    </button>
  );
}

// ── Area Column ───────────────────────────────────────────────────────────────
function AreaColumn({ area, deployment, gangs, onSetup, onClose, onDelete, onToggle, permission }) {
  const cfg = AREA_CFG[area];
  const canManage = permission;

  if (!deployment) {
    return (
      <div className={clsx('rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 min-h-[300px]', cfg.border)}>
        <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl', cfg.bg)}>
          {cfg.icon}
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">{area}</p>
          <p className="text-xs text-gray-400 mt-0.5">No gang assigned</p>
        </div>
        {canManage && (
          <button
            onClick={() => onSetup(area)}
            className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-white font-medium', cfg.bg)}
          >
            <Plus size={13} /> Assign Gang
          </button>
        )}
      </div>
    );
  }

  const { summary, attendance, status, gang_name, gang_color } = deployment;
  const gc    = GANG_COLOR[gang_color] || GANG_COLOR.blue;
  const isClosed = status === 'closed';
  const pct   = summary.total ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <div className={clsx('rounded-2xl border flex flex-col gap-0 overflow-hidden', cfg.border)}>
      {/* Header */}
      <div className={clsx('px-4 py-3 text-white flex items-center justify-between gap-2', cfg.bg)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.icon}</span>
          <div>
            <p className="text-xs font-bold tracking-wide">{area}</p>
            <p className="text-[10px] opacity-80">{gang_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isClosed
            ? <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={9}/> Closed</span>
            : canManage && <>
                <button onClick={() => onClose(deployment.id)} title="Close shift"
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30">
                  <Lock size={12} />
                </button>
                <button onClick={() => onDelete(deployment.id)} title="Remove assignment"
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30">
                  <Trash2 size={12} />
                </button>
              </>
          }
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between text-xs mb-1">
          <SummaryPill present={summary.present + summary.late} total={summary.total} />
          <span className="text-gray-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
          <span className="text-green-600 font-medium">{summary.present} ✓</span>
          <span className="text-yellow-600 font-medium">{summary.late} ◷</span>
          <span className="text-red-600 font-medium">{summary.absent} ✗</span>
          <span className="text-gray-400">{summary.pending} ?</span>
        </div>
      </div>

      {/* Marshal list */}
      <div className="flex flex-col gap-1 p-3 bg-gray-50/50 overflow-y-auto max-h-[480px]">
        {attendance.length === 0 && (
          <p className="text-xs text-center text-gray-400 py-4">No members enrolled</p>
        )}
        {attendance.map(att => (
          <MarshalCard
            key={att.id}
            att={att}
            onToggle={onToggle}
            isClosed={isClosed}
            isOT={att.is_overtime}
          />
        ))}
      </div>
    </div>
  );
}

// ── Setup Modal ───────────────────────────────────────────────────────────────
function SetupModal({ preArea, date, shift, gangs, onClose, onCreated }) {
  const [area,            setArea]            = useState(preArea || 'IMPORTS');
  const [selected,        setSelected]        = useState(new Set());
  const [primaryGangId,   setPrimaryGangId]   = useState(null);
  const [notes,           setNotes]           = useState('');

  const groupType = area === 'INTRUSIVE' ? 'INTRUSIVE' : 'SCAN';

  const { data: allMembers = [], isLoading: membersLoading } = useQuery(
    ['marshal-all-members', groupType],
    () => marshalApi.listAllMembers(groupType),
    { staleTime: 60000 }
  );

  // Reset selection whenever groupType changes (area switched between SCAN/INTRUSIVE)
  useEffect(() => {
    setSelected(new Set());
    setPrimaryGangId(null);
  }, [groupType]);

  // Members keyed by gang
  const membersByGang = useMemo(() =>
    gangs.map(g => ({ ...g, members: allMembers.filter(m => m.gang_id === g.id) })),
    [gangs, allMembers]
  );

  const toggleGang = (gang) => {
    const ids = gang.members.map(m => m.id);
    const allChecked = ids.every(id => selected.has(id));
    const next = new Set(selected);
    if (allChecked) {
      ids.forEach(id => next.delete(id));
      if (primaryGangId === gang.id) setPrimaryGangId(null);
    } else {
      ids.forEach(id => next.add(id));
      if (!primaryGangId) setPrimaryGangId(gang.id);
    }
    setSelected(next);
  };

  const toggleMember = (memberId, gangId) => {
    const next = new Set(selected);
    if (next.has(memberId)) {
      next.delete(memberId);
    } else {
      next.add(memberId);
      if (!primaryGangId) setPrimaryGangId(gangId);
    }
    setSelected(next);
  };

  const effectiveGangId = primaryGangId ||
    (membersByGang.find(g => g.members.some(m => selected.has(m.id)))?.id ?? null);

  const mut = useMutation(
    () => marshalApi.createDeployment({
      deployment_date: date, shift, area,
      gang_id: effectiveGangId,
      notes: notes || undefined,
      member_ids: Array.from(selected),
    }),
    {
      onSuccess: () => { toast.success(`${area} deployment created.`); onCreated(); onClose(); },
      onError:   e  => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Plus size={15} /> Assign Gang to Area
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Area picker */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Area</label>
          <div className="flex gap-2">
            {AREAS.map(a => (
              <button key={a} onClick={() => setArea(a)}
                className={clsx('flex-1 py-2 rounded-xl text-xs font-semibold border transition-all',
                  area === a ? `${AREA_CFG[a].bg} text-white border-transparent` : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}>
                {AREA_CFG[a].icon} {a}
              </button>
            ))}
          </div>
        </div>

        {/* Member picker */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">
              Select members — tick substitutes from any gang
            </label>
            {selected.size > 0 && (
              <span className="text-xs font-bold text-blue-600">{selected.size} selected</span>
            )}
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : membersByGang.map(gang => {
            const checkedCount = gang.members.filter(m => selected.has(m.id)).length;
            const allChecked   = gang.members.length > 0 && checkedCount === gang.members.length;
            const someChecked  = checkedCount > 0 && !allChecked;
            const gc = GANG_COLOR[gang.color] || GANG_COLOR.blue;

            return (
              <div key={gang.id} className="rounded-xl border overflow-hidden">
                {/* Gang header */}
                <button
                  onClick={() => toggleGang(gang)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className={clsx(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                    allChecked ? 'bg-blue-600 border-blue-600' : someChecked ? 'bg-blue-100 border-blue-400' : 'border-gray-300'
                  )}>
                    {(allChecked || someChecked) && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-current text-white stroke-2">
                        {allChecked
                          ? <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/>
                          : <path d="M2 4h6" strokeLinecap="round"/>
                        }
                      </svg>
                    )}
                  </span>
                  <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded-full', gc.badge)}>
                    {gang.code}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">{gang.name}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {checkedCount}/{gang.members.length}
                  </span>
                </button>

                {/* Member rows */}
                {gang.members.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No members in this group</p>
                ) : (
                  <div>
                    {gang.members.map(m => {
                      const roleTag = m.role === 'headman' ? 'HM' : m.role === 'foreman' ? 'FM' : null;
                      const isChecked = selected.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={clsx(
                            'flex items-center gap-3 px-4 py-2 cursor-pointer border-t border-gray-100 transition-colors',
                            isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleMember(m.id, gang.id)}
                            className="w-4 h-4 rounded accent-blue-600"
                          />
                          <span className="w-5 text-[11px] text-gray-400 text-right shrink-0">{m.position_no}</span>
                          <span className={clsx('flex-1 text-sm', isChecked ? 'font-medium text-gray-900' : 'text-gray-700')}>
                            {m.full_name}
                          </span>
                          {roleTag && (
                            <span className="shrink-0 text-[10px] font-bold bg-white border rounded-full px-1.5 py-0.5 text-gray-500">
                              {roleTag}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes + actions */}
        <div className="px-5 py-4 border-t space-y-3 shrink-0">
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={selected.size === 0 || !effectiveGangId || mut.isLoading}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {mut.isLoading ? 'Creating…' : `Deploy ${selected.size || ''} members`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overtime Modal ────────────────────────────────────────────────────────────
function OvertimeModal({ date, shift, deployments, onClose, onRecorded }) {
  const [memberId,   setMemberId]   = useState('');
  const [fromDepId,  setFromDepId]  = useState('');
  const [toDepId,    setToDepId]    = useState('');
  const [reason,     setReason]     = useState('');

  // Flatten all present members across deployments
  const presentMembers = useMemo(() => {
    const out = [];
    Object.values(deployments).forEach(dep => {
      if (!dep) return;
      dep.attendance.filter(a => a.status === 'present' || a.status === 'late').forEach(a => {
        out.push({ ...a, dep_id: dep.id, dep_area: dep.area, gang_name: dep.gang_name });
      });
    });
    return out;
  }, [deployments]);

  const mut = useMutation(
    () => marshalApi.recordOvertime({ member_id: parseInt(memberId), from_deployment_id: parseInt(fromDepId), to_deployment_id: parseInt(toDepId), reason }),
    {
      onSuccess: () => { toast.success('Overtime recorded.'); onRecorded(); onClose(); },
      onError:   e  => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const depOptions = Object.values(deployments).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-orange-700">
            <Timer size={15} /> Record Overtime Extension
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Select the marshal staying behind, which shift they're leaving, and which shift they're extending into.
          </p>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Marshal</label>
            <select value={memberId} onChange={e => setMemberId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Select marshal…</option>
              {presentMembers.map(m => (
                <option key={`${m.member_id}-${m.dep_id}`} value={m.member_id}>
                  {m.full_name} — {m.dep_area} ({m.gang_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Leaving from (area)</label>
            <select value={fromDepId} onChange={e => setFromDepId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Select…</option>
              {depOptions.map(d => <option key={d.id} value={d.id}>{d.area} — {d.gang_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Extending into (area)</label>
            <select value={toDepId} onChange={e => setToDepId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Select…</option>
              {depOptions.filter(d => d.id !== parseInt(fromDepId)).map(d =>
                <option key={d.id} value={d.id}>{d.area} — {d.gang_name}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. shortage at Intrusive"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
            <button onClick={() => mut.mutate()} disabled={!memberId || !fromDepId || !toDepId || mut.isLoading}
              className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40">
              {mut.isLoading ? 'Saving…' : 'Record OT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Member Management Modal ───────────────────────────────────────────────────
function MemberModal({ gang, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: '', employee_id: '', position_no: '', role: 'marshal', group_type: 'SCAN' });
  const { data: members = [], isLoading } = useQuery(
    ['marshal-members', gang.id],
    () => marshalApi.listMembers(gang.id)
  );

  const addMut = useMutation(
    () => marshalApi.addMember(gang.id, form),
    {
      onSuccess: () => {
        toast.success('Member added.');
        setForm(p => ({ full_name: '', employee_id: '', position_no: '', role: 'marshal', group_type: p.group_type }));
        qc.invalidateQueries(['marshal-members', gang.id]);
        qc.invalidateQueries('marshal-gangs');
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const delMut = useMutation(
    (memberId) => marshalApi.deleteMember(gang.id, memberId),
    {
      onSuccess: () => {
        toast.success('Removed.');
        qc.invalidateQueries(['marshal-members', gang.id]);
        qc.invalidateQueries('marshal-gangs');
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const scanMembers      = members.filter(m => m.group_type === 'SCAN');
  const intrusiveMembers = members.filter(m => m.group_type === 'INTRUSIVE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users size={15} /> {gang.name} — Members
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add form */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Add Member</p>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Full name *" value={form.full_name} onChange={e => f('full_name', e.target.value)}
                className="col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Employee ID" value={form.employee_id} onChange={e => f('employee_id', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Position No *" value={form.position_no} onChange={e => f('position_no', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.role} onChange={e => f('role', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="marshal">Marshal</option>
                <option value="headman">Head Man</option>
                <option value="foreman">Foreman</option>
              </select>
              <select value={form.group_type} onChange={e => f('group_type', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="SCAN">Scan Marshal</option>
                <option value="INTRUSIVE">Intrusive</option>
              </select>
            </div>
            <button onClick={() => addMut.mutate()}
              disabled={!form.full_name || !form.position_no || addMut.isLoading}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
              {addMut.isLoading ? 'Adding…' : 'Add Member'}
            </button>
          </div>

          {/* Member list — split by group */}
          {isLoading ? <p className="text-xs text-center text-gray-400">Loading…</p> : (
            <>
              {[{ label: 'Scan Marshals', items: scanMembers, badge: 'bg-blue-100 text-blue-700' },
                { label: 'Intrusive',     items: intrusiveMembers, badge: 'bg-purple-100 text-purple-700' }
              ].map(({ label, items, badge }) => (
                <div key={label}>
                  <p className={clsx('text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5', badge.split(' ')[1])}>
                    {label} ({items.length})
                  </p>
                  <div className="space-y-1">
                    {items.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="w-6 h-6 rounded-full bg-white border text-xs font-bold flex items-center justify-center text-gray-600">
                          {m.position_no}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                          {m.employee_id && <p className="text-xs text-gray-400">{m.employee_id}</p>}
                        </div>
                        <span className="text-[10px] font-semibold bg-white border rounded-full px-2 py-0.5 text-gray-500 capitalize">
                          {m.role}
                        </span>
                        <button onClick={() => delMut.mutate(m.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {!items.length && <p className="text-xs text-gray-400 px-1 pb-1">None</p>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Overtime Report Tab ───────────────────────────────────────────────────────
function OvertimeTab({ date, shift }) {
  const { data: records = [], isLoading } = useQuery(
    ['marshal-overtime', date, shift],
    () => marshalApi.getOvertimeReport({ date, shift }),
    { refetchInterval: 30000 }
  );
  const qc = useQueryClient();

  const removeMut = useMutation(
    (id) => marshalApi.removeOvertime(id),
    {
      onSuccess: () => { toast.success('Removed.'); qc.invalidateQueries(['marshal-overtime', date, shift]); },
    }
  );

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <Timer size={36} className="opacity-30" />
          <p className="text-sm">No overtime extensions recorded for this shift</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.ot_id} className={clsx('rounded-2xl border p-4',
              parseInt(r.consecutive_count) >= 3 ? 'border-red-200 bg-red-50' :
              parseInt(r.consecutive_count) >= 2 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold',
                    parseInt(r.consecutive_count) >= 3 ? 'bg-red-500' : parseInt(r.consecutive_count) >= 2 ? 'bg-orange-500' : 'bg-yellow-500'
                  )}>
                    {r.consecutive_count}x
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{r.role} · {r.gang_name}</p>
                  </div>
                </div>
                <button onClick={() => removeMut.mutate(r.ot_id)} className="text-gray-300 hover:text-red-500">
                  <X size={15} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="bg-white border rounded-lg px-2 py-1 text-gray-600">{r.from_area} ({r.from_shift})</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="bg-orange-100 border border-orange-200 rounded-lg px-2 py-1 text-orange-700 font-medium">{r.to_area} ({r.to_shift})</span>
              </div>
              {r.reason && <p className="text-xs text-gray-400 mt-2 italic">"{r.reason}"</p>}
              {parseInt(r.consecutive_count) >= 3 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-700 bg-red-100 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={12} />
                  <span>High fatigue risk — {r.consecutive_count} consecutive shifts this week</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gang Roster Panel ─────────────────────────────────────────────────────────
function GangRosterPanel({ gangs, onManage }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {gangs.map(g => {
        const gc = GANG_COLOR[g.color] || GANG_COLOR.blue;
        return (
          <div key={g.id} className={clsx('rounded-2xl border-2 p-4 flex flex-col gap-3', gc.ring.replace('ring', 'border'))}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{g.name}</p>
                <p className="text-xs text-gray-400">{g.scan_count} scan · {g.intrusive_count} intrusive</p>
              </div>
              <span className={clsx('text-xs font-bold px-2 py-1 rounded-full', gc.badge)}>{g.code}</span>
            </div>
            <button onClick={() => onManage(g)}
              className="w-full py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
              Manage Roster
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarshalDeploymentPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission('marshal.manage');

  const [date,       setDate]       = useState(today());
  const [shift,      setShift]      = useState('DAY');
  const [activeTab,  setActiveTab]  = useState('attendance');
  const [setupArea,  setSetupArea]  = useState(null);
  const [showOTModal, setShowOTModal] = useState(false);
  const [managingGang, setManagingGang] = useState(null);

  // Queries
  const { data: gangs = [], isLoading: gangsLoading } = useQuery('marshal-gangs', marshalApi.listGangs);

  const depKey = ['marshal-deployments', date, shift];
  const { data: deployments = {}, isLoading: depsLoading, refetch } = useQuery(
    depKey,
    () => marshalApi.getDeploymentView({ date, shift }),
    { refetchInterval: 15000 }
  );

  // Mutations
  const toggleMut = useMutation(
    (attId) => marshalApi.toggleAttendance(attId),
    {
      onSuccess: () => qc.invalidateQueries(depKey),
      onError:   e  => toast.error(e.response?.data?.error || 'Failed to update attendance.'),
    }
  );

  const closeMut = useMutation(
    (id) => marshalApi.closeDeployment(id),
    {
      onSuccess: () => { toast.success('Deployment closed.'); qc.invalidateQueries(depKey); },
      onError:   e  => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const deleteMut = useMutation(
    (id) => marshalApi.deleteDeployment(id),
    {
      onSuccess: () => { toast.success('Removed.'); qc.invalidateQueries(depKey); },
      onError:   e  => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  // Summary across all areas
  const totalPresent = Object.values(deployments).filter(Boolean).reduce((s, d) => s + (d.summary?.present || 0), 0);
  const totalMembers = Object.values(deployments).filter(Boolean).reduce((s, d) => s + (d.summary?.total  || 0), 0);
  const totalAbsent  = Object.values(deployments).filter(Boolean).reduce((s, d) => s + (d.summary?.absent || 0), 0);
  const totalPending = Object.values(deployments).filter(Boolean).reduce((s, d) => s + (d.summary?.pending || 0), 0);

  const TABS = [
    { key: 'attendance', label: 'Attendance',    icon: UserCheck     },
    { key: 'overtime',   label: 'Overtime',      icon: Timer         },
    { key: 'roster',     label: 'Gang Rosters',  icon: ClipboardList },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" /> Marshal Deployment
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Track attendance and overtime by area</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {SHIFTS.map(s => (
              <button key={s} onClick={() => setShift(s)}
                className={clsx('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors',
                  shift === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                )}>
                {s === 'DAY' ? <Sun size={12} /> : <Moon size={12} />} {s}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {totalMembers > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Present', value: totalPresent, color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle },
            { label: 'Absent',  value: totalAbsent,  color: 'text-red-600   bg-red-50   border-red-200',   icon: XCircle    },
            { label: 'Pending', value: totalPending,  color: 'text-gray-500  bg-gray-50  border-gray-200',  icon: Minus      },
            { label: 'Total',   value: totalMembers,  color: 'text-blue-600  bg-blue-50  border-blue-200',  icon: Users      },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={clsx('rounded-2xl border p-3 flex items-center gap-3', color)}>
              <Icon size={20} className="opacity-70" />
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="text-xs opacity-70 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
        {canManage && activeTab === 'attendance' && (
          <button onClick={() => setShowOTModal(true)}
            className="ml-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200">
            <Timer size={13} /> + Overtime
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'attendance' && (
        depsLoading
          ? <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
          : <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AREAS.map(area => (
                <AreaColumn
                  key={area}
                  area={area}
                  deployment={deployments[area]}
                  gangs={gangs}
                  onSetup={setSetupArea}
                  onClose={(id) => closeMut.mutate(id)}
                  onDelete={(id) => deleteMut.mutate(id)}
                  onToggle={(id) => toggleMut.mutate(id)}
                  permission={canManage}
                />
              ))}
            </div>
      )}

      {activeTab === 'overtime' && <OvertimeTab date={date} shift={shift} />}

      {activeTab === 'roster' && (
        gangsLoading
          ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
          : <GangRosterPanel gangs={gangs} onManage={setManagingGang} />
      )}

      {/* Modals */}
      {setupArea && (
        <SetupModal
          preArea={setupArea}
          date={date}
          shift={shift}
          gangs={gangs}
          onClose={() => setSetupArea(null)}
          onCreated={() => qc.invalidateQueries(depKey)}
        />
      )}

      {showOTModal && (
        <OvertimeModal
          date={date}
          shift={shift}
          deployments={deployments}
          onClose={() => setShowOTModal(false)}
          onRecorded={() => { qc.invalidateQueries(depKey); qc.invalidateQueries(['marshal-overtime', date, shift]); }}
        />
      )}

      {managingGang && (
        <MemberModal gang={managingGang} onClose={() => setManagingGang(null)} />
      )}
    </div>
  );
}
