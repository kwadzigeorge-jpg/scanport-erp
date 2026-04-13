import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { dashboardApi } from '../services/api';
import { format } from 'date-fns';
import { io as socketIO } from 'socket.io-client';
import {
  LayoutDashboard, Container, MapPin, Microscope, CheckCircle,
  LogOut, AlertTriangle, Clock, Users, Activity,
  RefreshCw, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';
import StatusBadge from '../components/Containers/StatusBadge';

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, icon: Icon, color, sub }) {
  const style = {
    blue:   'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green:  'bg-green-50 text-green-600 border-green-200',
    red:    'bg-red-50 text-red-600 border-red-200',
    gray:   'bg-gray-50 text-gray-500 border-gray-200',
  };
  return (
    <div className={clsx('rounded-2xl border p-4 flex flex-col gap-2', style[color] || style.gray)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <Icon size={18} className="opacity-60" />
      </div>
      <p className="text-3xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// ─── Live Pipeline ────────────────────────────────────────────────────────────
function Pipeline({ summary }) {
  const steps = [
    { key: 'arrived_at_booth',       label: 'At Booth',      color: '#60a5fa' },
    { key: 'pending_bay_assignment', label: 'Pending Bay',   color: '#818cf8' },
    { key: 'bay_assigned',           label: 'Bay Assigned',  color: '#a78bfa' },
    { key: 'arrived_at_bay',         label: 'At Bay',        color: '#f59e0b' },
    { key: 'under_examination',      label: 'Under Exam',    color: '#f97316' },
    { key: 'examination_completed',  label: 'Exam Done',     color: '#22c55e' },
  ];
  const maxCount = Math.max(...steps.map(s => summary?.[s.key] || 0), 1);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Activity size={15} className="text-blue-500" /> Live Pipeline
      </h3>
      <div className="flex items-end gap-1.5">
        {steps.map((s) => {
          const count = summary?.[s.key] || 0;
          const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 4);
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-gray-800">{count}</span>
              <div className="w-full rounded-t-md transition-all duration-500"
                style={{ height: `${pct * 0.8 + 8}px`, backgroundColor: s.color }} title={`${s.label}: ${count}`} />
              <span className="text-center text-gray-500 leading-tight" style={{ fontSize: '9px' }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Throughput chart ─────────────────────────────────────────────────────────
function TrendChart({ trend }) {
  if (!trend?.length) return null;
  const data = trend.map(r => ({
    time: format(new Date(r.hour || r.day), r.hour ? 'HH:mm' : 'dd/MM'),
    entered: parseInt(r.entries || r.entered) || 0,
    exited:  parseInt(r.exits  || r.exited)  || 0,
  }));
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <BarChart3 size={15} className="text-blue-500" /> Throughput (last 24 h)
      </h3>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
          <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="entered" fill="#60a5fa" radius={[3,3,0,0]} name="Entered" />
          <Bar dataKey="exited"  fill="#34d399" radius={[3,3,0,0]} name="Exited" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Overstayed ───────────────────────────────────────────────────────────────
function OverstayedAlert({ threshold }) {
  const { data } = useQuery('overstayed', () =>
    dashboardApi.overstayed().then(r => r.data), { refetchInterval: 60000 }
  );
  const list = Array.isArray(data) ? data : data?.containers || [];
  if (!list.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-200">
        <AlertTriangle size={15} className="text-red-600" />
        <span className="text-sm font-semibold text-red-700">Overstayed ({list.length}) — &gt;{threshold}h</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
        {list.map((c, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-2.5">
            <div>
              <p className="font-mono font-semibold text-sm text-gray-900">{c.container_number}</p>
              {c.waybill_number && <p className="text-xs text-gray-400">WB: {c.waybill_number}</p>}
              <p className="text-xs text-gray-500">{c.area_name} · {c.bay_code}</p>
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {Math.round((c.minutes_active || c.minutes_in_system || 0) / 60)}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────────
function RecentActivity({ transactions }) {
  if (!transactions?.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Recent Activity</p>
      </div>
      <div className="divide-y divide-gray-50">
        {transactions.slice(0, 8).map((t, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm text-gray-900">{t.container_number}</span>
                {t.waybill_number && <span className="text-xs text-gray-400">{t.waybill_number}</span>}
              </div>
              <p className="text-xs text-gray-500 truncate">{t.agent_name} · {t.area_name || '—'}</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <StatusBadge status={t.status} />
              <p className="text-xs text-gray-400 mt-1">{format(new Date(t.created_at), 'HH:mm')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Active Users ─────────────────────────────────────────────────────────────
function ActiveUsers({ sessions }) {
  if (!sessions?.length) return null;
  const rb = { admin: 'bg-red-100 text-red-700', supervisor: 'bg-purple-100 text-purple-700', booth_officer: 'bg-blue-100 text-blue-700', marshal: 'bg-green-100 text-green-700' };
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
        <Users size={14} className="text-gray-500" />
        <p className="text-sm font-semibold text-gray-700">Active Users ({sessions.length})</p>
      </div>
      <div className="divide-y divide-gray-50">
        {sessions.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-2.5">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
              <p className="text-xs text-gray-400">@{s.username}</p>
            </div>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', rb[s.role] || 'bg-gray-100 text-gray-600')}>
              {s.role?.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data, isLoading, refetch } = useQuery(
    'dashboard-summary',
    () => dashboardApi.summary().then(r => r.data),
    { refetchInterval: 30000, onSuccess: () => setLastUpdate(new Date()) }
  );

  useEffect(() => {
    const socket = socketIO({ path: '/socket.io', transports: ['websocket'] });
    socket.on('transaction:new',     () => refetch());
    socket.on('transaction:updated', () => refetch());
    return () => socket.disconnect();
  }, [refetch]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const s       = data?.summary || {};
  const today   = data?.today   || {};
  const bays    = data?.bays    || {};
  const threshold = data?.overstayThresholdHours || 3;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard size={20} className="text-blue-600" /> Operations Dashboard
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Updated {format(lastUpdate, 'HH:mm:ss')}</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Active Containers" value={s.total_active} icon={Container} color="blue" sub="in system now" />
        <StatTile label="At Bay / In Exam" value={(s.arrived_at_bay||0)+(s.under_examination||0)+(s.examination_completed||0)} icon={Microscope} color="yellow" sub="undergoing processing" />
        <StatTile label="Exited Today" value={today.exited} icon={LogOut} color="green" sub={`Avg dwell: ${today.avg_dwell||0} min`} />
        <StatTile label="Overstayed" value={s.overstayed} icon={AlertTriangle} color={s.overstayed > 0 ? 'red' : 'gray'} sub={`>${threshold}h`} />
      </div>

      {/* Bay utilisation */}
      <div className="card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600 font-medium flex items-center gap-1.5">
            <MapPin size={14} className="text-gray-400" /> Bay Utilisation
          </span>
          <span className="font-bold text-gray-900">{bays.utilization_pct || 0}% &nbsp;
            <span className="text-gray-400 font-normal text-xs">({bays.occupied}/{bays.total} bays)</span>
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={clsx('h-3 rounded-full transition-all',
            (bays.utilization_pct||0) > 80 ? 'bg-red-500' : (bays.utilization_pct||0) > 60 ? 'bg-orange-400' : 'bg-green-500'
          )} style={{ width: `${bays.utilization_pct || 0}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{bays.occupied||0} occupied</span>
          <span>{bays.free||0} available</span>
        </div>
      </div>

      {/* Pipeline + chart */}
      <div className="grid md:grid-cols-2 gap-4">
        <Pipeline summary={s} />
        <TrendChart trend={data?.trend} />
      </div>

      {/* Overstayed alert */}
      {s.overstayed > 0 && <OverstayedAlert threshold={threshold} />}

      {/* Recent + users */}
      <div className="grid md:grid-cols-2 gap-4">
        <RecentActivity transactions={data?.recentTransactions} />
        <ActiveUsers sessions={data?.activeSessions} />
      </div>
    </div>
  );
}
