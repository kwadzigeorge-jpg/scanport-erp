import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { reportsApi, containersApi } from '../services/api';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, Area, AreaChart,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  LayoutDashboard, Clock, MapPin, Users, AlertTriangle,
  Download, X, RefreshCw, ChevronRight, Shield,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const today   = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

const TABS = [
  { key: 'dashboard',  label: 'Operations Control', icon: LayoutDashboard },
  { key: 'dwell',      label: 'Dwell Time',         icon: Clock },
  { key: 'areas',      label: 'Area Performance',   icon: MapPin },
  { key: 'agents',     label: 'Agent Performance',  icon: Users },
  { key: 'exceptions', label: 'SLA Exceptions',     icon: AlertTriangle },
  { key: 'audit',      label: 'Audit Trail',        icon: Shield },
];

// ─── SLA helpers ──────────────────────────────────────────────────────────────
function slaStatus(dwellMin, slaMin) {
  if (dwellMin >= slaMin)        return 'breach';
  if (dwellMin >= slaMin * 0.8)  return 'warning';
  return 'ok';
}

function SLABadge({ dwellMin, slaMin, active = false }) {
  const s = slaStatus(dwellMin, slaMin);
  const over = dwellMin - slaMin;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
      s === 'breach'  && 'bg-red-100 text-red-700',
      s === 'warning' && 'bg-amber-100 text-amber-700',
      s === 'ok'      && 'bg-green-100 text-green-700',
    )}>
      {s === 'breach'  && <span className={clsx('w-1.5 h-1.5 rounded-full bg-red-500', active && 'animate-pulse')} />}
      {s === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      {s === 'ok'      && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
      {s === 'breach'  ? `+${over}min` : s === 'warning' ? `${Math.round((dwellMin/slaMin)*100)}%` : 'OK'}
    </span>
  );
}

function fmtDwell(min) {
  if (min == null) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ─── Global Filter Bar ────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, onExport, exporting }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex flex-wrap items-end gap-3 shrink-0">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
        <select className="input text-sm py-1.5" value={filters.preset}
          onChange={e => {
            const p = e.target.value;
            const t = new Date().toISOString().slice(0, 10);
            const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            const w = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            onChange({ ...filters, preset: p,
              from: p === 'today' ? t : p === 'yesterday' ? y : p === 'week' ? w : filters.from,
              to:   p === 'yesterday' ? y : t,
            });
          }}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">Last 7 Days</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      {filters.preset === 'custom' && <>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" className="input text-sm py-1.5" value={filters.from} max={today}
            onChange={e => onChange({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" className="input text-sm py-1.5" value={filters.to} max={today}
            onChange={e => onChange({ ...filters, to: e.target.value })} />
        </div>
      </>}
      <div className="ml-auto">
        <button onClick={onExport} disabled={exporting}
          className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <Download size={15} />
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>
    </div>
  );
}

// ─── Container Detail Drawer ──────────────────────────────────────────────────
function ContainerDrawer({ id, slaMin, onClose }) {
  const { data, isLoading } = useQuery(
    ['container-detail', id],
    () => containersApi.get(id).then(r => r.data),
    { enabled: !!id }
  );

  const timeline = data?.timeline || [];
  const dwell = data
    ? (data.status === 'EXITED' ? data.dwell_minutes
      : Math.round((Date.now() - new Date(data.time_in || data.arrival_time || data.created_at)) / 60000))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">{data?.container_number || '…'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-xl p-4">
              <div><span className="text-gray-500">Transaction</span><p className="font-mono font-semibold">{data.transaction_id}</p></div>
              <div><span className="text-gray-500">Waybill</span><p className="font-medium">{data.waybill_number || '—'}</p></div>
              <div><span className="text-gray-500">Agent</span><p className="font-medium">{data.agent_name}</p></div>
              <div><span className="text-gray-500">Area</span><p className="font-medium">{data.area_name || '—'}</p></div>
              <div><span className="text-gray-500">Bay</span><p className="font-medium">{data.bay_code || '—'}</p></div>
              <div><span className="text-gray-500">Status</span><p className="font-medium">{data.status}</p></div>
            </div>
            {dwell != null && slaMin && (
              <div className="flex items-center gap-3 p-3 rounded-xl border">
                <div>
                  <p className="text-xs text-gray-500">Dwell time</p>
                  <p className="text-lg font-bold text-gray-900">{fmtDwell(dwell)}</p>
                </div>
                <div className="ml-auto">
                  <SLABadge dwellMin={dwell} slaMin={slaMin} active={data.status !== 'EXITED'} />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Timeline</h3>
              <div className="space-y-3">
                {timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="font-medium text-gray-800">{t.label}</p>
                      <p className="text-xs text-gray-400">{format(new Date(t.time), 'dd MMM yyyy HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Not found</div>}
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent, onClick }) {
  return (
    <button onClick={onClick}
      className={clsx('text-left bg-white rounded-xl border p-4 space-y-1 transition-shadow hover:shadow-md w-full',
        accent === 'red'   && 'border-red-200 bg-red-50',
        accent === 'amber' && 'border-amber-200 bg-amber-50',
        accent === 'blue'  && 'border-blue-200',
        !accent            && 'border-gray-200',
      )}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={clsx('text-2xl font-bold',
        accent === 'red'   && 'text-red-700',
        accent === 'amber' && 'text-amber-700',
        accent === 'blue'  && 'text-blue-700',
        !accent            && 'text-gray-900',
      )}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </button>
  );
}

// ─── Report Table ─────────────────────────────────────────────────────────────
function ReportTable({ loading, rows, columns, onRowClick, rowClassName }) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{columns.map(c => (
              <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                {c.label}
              </th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!rows?.length ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-gray-400">No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i}
                onClick={() => onRowClick?.(row)}
                className={clsx('transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-blue-50/50',
                  rowClassName?.(row)
                )}>
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page 1: Operations Control Dashboard ─────────────────────────────────────
function periodLabel(filters) {
  if (filters.preset === 'today')     return 'today';
  if (filters.preset === 'yesterday') return 'yesterday';
  if (filters.preset === 'week')      return 'last 7 days';
  return `${filters.from} – ${filters.to}`;
}

function DashboardTab({ filters, onSelectContainer }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery(
    ['ops-dashboard', filters.from, filters.to],
    () => reportsApi.operationsDashboard({ from: filters.from, to: filters.to }).then(r => r.data),
    { refetchInterval: 30000 }
  );

  const kpi = data?.kpi || {};
  const slaMin = data?.sla_minutes || 180;
  const containers = data?.active_containers || [];

  const liveDwell = useCallback((startTime) => {
    void tick;
    return Math.round((Date.now() - new Date(startTime).getTime()) / 60000);
  }, [tick]);

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Live Operations — auto-refreshes every 30s · Period: {periodLabel(filters)}</h2>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard label="In Holding" value={kpi.containers_in_holding ?? '—'} sub="active containers" />
        <KPICard label="Avg Dwell" value={kpi.avg_dwell_today != null ? fmtDwell(kpi.avg_dwell_today) : '—'} sub={`released — ${periodLabel(filters)}`} />
        <KPICard
          label="Active Breaches" value={kpi.active_breaches ?? '—'}
          sub="exceeding SLA" accent={kpi.active_breaches > 0 ? 'red' : null}
          onClick={() => {}} />
        <KPICard
          label="Longest Dwell"
          value={kpi.longest_dwell_minutes != null ? fmtDwell(kpi.longest_dwell_minutes) : '—'}
          sub={kpi.longest_container || ''}
          accent={kpi.longest_dwell_minutes > slaMin ? 'red' : kpi.longest_dwell_minutes > slaMin * 0.8 ? 'amber' : null} />
        <KPICard label="Throughput" value={kpi.throughput_today ?? '—'} sub={`released — ${periodLabel(filters)}`} accent="blue" />
        <KPICard
          label="Capacity"
          value={`${kpi.utilisation_pct ?? 0}%`}
          sub={`${kpi.occupied_bays ?? 0}/${kpi.total_bays ?? 0} bays`}
          accent={kpi.utilisation_pct >= 95 ? 'red' : kpi.utilisation_pct >= 80 ? 'amber' : null} />
      </div>

      {/* Capacity bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Bay Utilisation</span>
          <span className="text-sm text-gray-500">{kpi.occupied_bays ?? 0} occupied · {(kpi.total_bays ?? 0) - (kpi.occupied_bays ?? 0)} available</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all duration-500',
            (kpi.utilisation_pct || 0) >= 95 ? 'bg-red-500' :
            (kpi.utilisation_pct || 0) >= 80 ? 'bg-amber-500' : 'bg-blue-500'
          )} style={{ width: `${kpi.utilisation_pct || 0}%` }} />
        </div>
      </div>

      {/* Dwell trend */}
      <DwellTrendChart slaMin={slaMin} />

      {/* Live containers table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Active Containers <span className="text-gray-400 font-normal">— sorted by dwell (highest first)</span>
        </h3>
        <ReportTable
          loading={isLoading}
          rows={containers}
          onRowClick={r => onSelectContainer(r.id)}
          rowClassName={r => {
            const d = liveDwell(r.start_time);
            if (d >= slaMin) return 'border-l-4 border-red-400 bg-red-50/30';
            if (d >= slaMin * 0.8) return 'border-l-4 border-amber-400 bg-amber-50/20';
            return '';
          }}
          columns={[
            { key: 'container_number', label: 'Container' },
            { key: 'area_name', label: 'Holding Area' },
            { key: 'agent_name', label: 'Agent' },
            { key: 'start_time', label: 'Time In', render: v => v ? format(new Date(v), 'HH:mm') : '—' },
            { key: 'start_time', label: 'Live Dwell', render: (v, r) => {
              const d = liveDwell(r.start_time);
              return <span className="font-mono font-semibold">{fmtDwell(d)}</span>;
            }},
            { key: 'status', label: 'SLA Status', render: (_, r) => (
              <SLABadge dwellMin={liveDwell(r.start_time)} slaMin={slaMin} active />
            )},
            { key: 'id', label: '', render: () => <ChevronRight size={14} className="text-gray-400" /> },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Dwell Trend Chart ────────────────────────────────────────────────────────
function DwellTrendChart({ slaMin }) {
  const [period, setPeriod] = useState('daily');

  const { data, isLoading } = useQuery(
    ['dwell-trend', period],
    () => reportsApi.dwellTrend({ period }).then(r => r.data),
    { refetchInterval: 300000 }
  );

  const rows = data?.rows || [];
  const thresholdMin = slaMin || data?.sla_minutes || 180;

  const PERIODS = [
    { key: 'daily',   label: 'Daily',   sub: 'Last 30 days' },
    { key: 'weekly',  label: 'Weekly',  sub: 'Last 12 weeks' },
    { key: 'monthly', label: 'Monthly', sub: 'Last 12 months' },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.value;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p className="text-blue-600">Avg dwell: <span className="font-bold">{fmtDwell(d)}</span></p>
        <p className="text-gray-400">Containers: {payload[0]?.payload?.count ?? '—'}</p>
        {d != null && d >= thresholdMin && (
          <p className="text-red-500 font-medium mt-1">SLA breached</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Average Dwell Time Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {PERIODS.find(p => p.key === period)?.sub} · SLA threshold: {fmtDwell(thresholdMin)}
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx(
                'px-3 py-1.5 transition-colors',
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No released container data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dwellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${Math.floor(v / 60)}h`}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={thresholdMin}
              stroke="#ef4444"
              strokeDasharray="4 3"
              label={{ value: 'SLA', position: 'right', fontSize: 10, fill: '#ef4444' }}
            />
            <Area
              type="monotone"
              dataKey="avg_dwell"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#dwellGrad)"
              dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Page 2: Dwell Time Analysis ──────────────────────────────────────────────
function DwellTab({ filters, onSelectContainer }) {
  const { data, isLoading } = useQuery(
    ['dwell-analysis', filters.from, filters.to],
    () => reportsApi.dwellAnalysis({ from: filters.from, to: filters.to }).then(r => r.data),
    { refetchInterval: 300000 }
  );

  const slaMin = data?.sla_minutes || 180;
  const hourlyData = data?.hourly || [];
  const dist = data?.distribution;
  const distData = dist ? [
    { label: '0–30 min', count: dist.bucket_0_30, fill: '#16a34a' },
    { label: '31–60 min', count: dist.bucket_31_60, fill: '#2563eb' },
    { label: '61–120 min', count: dist.bucket_61_120, fill: '#d97706' },
    { label: '120+ min', count: dist.bucket_120_plus, fill: '#dc2626' },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        {/* Hourly line chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Average Dwell by Hour of Day</h3>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hourlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="hour" tickFormatter={h => `${h}:00`} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="m" />
                <Tooltip formatter={(v) => [`${v} min`, 'Avg Dwell']} labelFormatter={h => `${h}:00`} />
                <ReferenceLine y={slaMin} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'SLA', fontSize: 10, fill: '#dc2626' }} />
                <Line type="monotone" dataKey="avg_dwell" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribution bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Dwell Time Distribution</h3>
          {isLoading ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Containers']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {dist && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <span>Total released: <b className="text-gray-800">{dist.total}</b></span>
              <span>120+ min: <b className={dist.bucket_120_plus > 0 ? 'text-red-600' : 'text-gray-800'}>{dist.bucket_120_plus}</b></span>
            </div>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">All Transactions</h3>
        <ReportTable
          loading={isLoading}
          rows={data?.detail}
          onRowClick={r => onSelectContainer(r.id)}
          rowClassName={r => {
            if ((r.effective_dwell || r.dwell_minutes) >= slaMin) return 'bg-red-50/40';
            if ((r.effective_dwell || r.dwell_minutes) >= slaMin * 0.8) return 'bg-amber-50/30';
            return '';
          }}
          columns={[
            { key: 'container_number', label: 'Container' },
            { key: 'agent_name', label: 'Agent' },
            { key: 'area', label: 'Area' },
            { key: 'bay_code', label: 'Bay' },
            { key: 'effective_dwell', label: 'Dwell', render: v => <span className="font-mono font-semibold">{fmtDwell(v)}</span> },
            { key: 'status', label: 'Status', render: (_, r) => (
              <SLABadge dwellMin={r.effective_dwell || r.dwell_minutes || 0} slaMin={slaMin} />
            )},
            { key: 'start_time', label: 'Check-in', render: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
            { key: 'time_out', label: 'Released', render: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Page 3: Area Performance ─────────────────────────────────────────────────
function AreasTab({ filters }) {
  const { data, isLoading, error } = useQuery(
    ['area-performance', filters.from, filters.to],
    () => reportsApi.areaPerformance({ from: filters.from, to: filters.to }).then(r => r.data),
    { refetchInterval: 60000 }
  );

  const slaMin = data?.sla_minutes || 180;
  const areas  = data?.areas || [];

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
      Failed to load area data: {error.response?.data?.error || error.message}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Area cards */}
      {isLoading ? <div className="text-center py-12 text-gray-400 text-sm">Loading…</div> : areas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No holding areas configured. Add holding areas in the system settings.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {areas.map(a => {
            const pct = a.total_bays ? Math.round((a.active_containers / a.total_bays) * 100) : 0;
            return (
              <div key={a.id} className={clsx('bg-white rounded-xl border p-4 space-y-3',
                a.active_breaches > 0 ? 'border-red-200' : 'border-gray-200'
              )}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{a.name}</h3>
                  {a.active_breaches > 0 && (
                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      {a.active_breaches} breach{a.active_breaches > 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Capacity</span>
                    <span>{pct}% ({a.active_containers}/{a.total_bays})</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full',
                      pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                    )} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold text-gray-900">{a.active_containers}</p><p className="text-xs text-gray-400">Active</p></div>
                  <div><p className="text-lg font-bold text-gray-900">{fmtDwell(a.avg_active_dwell)}</p><p className="text-xs text-gray-400">Avg Dwell</p></div>
                  <div><p className={clsx('text-lg font-bold', a.max_active_dwell > slaMin ? 'text-red-600' : 'text-gray-900')}>{fmtDwell(a.max_active_dwell)}</p><p className="text-xs text-gray-400">Max Dwell</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary table */}
      <ReportTable
        loading={isLoading}
        rows={areas}
        columns={[
          { key: 'name', label: 'Holding Area' },
          { key: 'active_containers', label: 'Active', render: v => <span className="font-semibold">{v}</span> },
          { key: 'avg_active_dwell', label: 'Avg Dwell', render: v => fmtDwell(v) },
          { key: 'max_active_dwell', label: 'Max Dwell', render: (v, r) => (
            <span className={v > slaMin ? 'text-red-600 font-semibold' : ''}>{fmtDwell(v)}</span>
          )},
          { key: 'active_breaches', label: 'Active Breaches', render: v => (
            <span className={clsx('font-semibold', v > 0 ? 'text-red-600' : 'text-gray-500')}>{v}</span>
          )},
          { key: 'total_bays', label: 'Total Bays' },
          { key: 'active_containers', label: 'Utilisation', render: (v, r) => {
            const pct = r.total_bays ? Math.round((v / r.total_bays) * 100) : 0;
            return <span className={pct >= 95 ? 'text-red-600 font-semibold' : pct >= 80 ? 'text-amber-600 font-semibold' : ''}>{pct}%</span>;
          }},
        ]}
      />
    </div>
  );
}

// ─── Page 4: Agent Performance ────────────────────────────────────────────────
function AgentsTab({ filters }) {
  const { data, isLoading } = useQuery(
    ['agent-performance', filters.from, filters.to],
    () => reportsApi.agentPerf({ from: filters.from, to: filters.to }).then(r => r.data),
    { refetchInterval: 120000 }
  );

  const slaMin = data?.sla_minutes || 180;
  const agents = data?.rows || [];

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        This view supports workload balancing and operational coaching — not performance ranking.
      </div>
      <ReportTable
        loading={isLoading}
        rows={agents}
        columns={[
          { key: 'agent_name', label: 'Agent', render: v => <span className="font-semibold">{v}</span> },
          { key: 'total_containers', label: 'Containers', render: v => <span className="font-semibold">{v}</span> },
          { key: 'released', label: 'Released' },
          { key: 'active', label: 'Active' },
          { key: 'avg_dwell', label: 'Avg Dwell', render: v => fmtDwell(v) },
          { key: 'max_dwell', label: 'Max Dwell', render: v => fmtDwell(v) },
          { key: 'released_breaches', label: 'Released Breaches', render: v => (
            <span className={clsx('font-semibold', v > 0 ? 'text-red-600' : 'text-gray-500')}>{v}</span>
          )},
          { key: 'active_breaches', label: 'Active Breaches', render: v => (
            <span className={clsx('font-semibold', v > 0 ? 'text-red-600 animate-pulse' : 'text-gray-500')}>{v}</span>
          )},
          { key: 'peak_hour', label: 'Peak Hour', render: v => v != null ? `${v}:00–${v + 1}:00` : '—' },
        ]}
      />
    </div>
  );
}

// ─── Page 5: SLA Exceptions ───────────────────────────────────────────────────
function ExceptionsTab({ filters, onSelectContainer }) {
  const { data, isLoading, refetch } = useQuery(
    ['sla-exceptions', filters.from, filters.to],
    () => reportsApi.slaExceptions({ from: filters.from, to: filters.to }).then(r => r.data),
    { refetchInterval: 30000 }
  );

  const slaMin = data?.sla_minutes || 180;
  const rows = data?.rows || [];
  const activeBreaches = rows.filter(r => r.breach_status === 'ACTIVE');

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className={clsx('rounded-xl border p-4 flex items-start gap-3',
        activeBreaches.length > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'
      )}>
        <AlertTriangle size={18} className={activeBreaches.length > 0 ? 'text-red-600 mt-0.5' : 'text-green-600 mt-0.5'} />
        <div className="flex-1">
          <p className={clsx('font-semibold', activeBreaches.length > 0 ? 'text-red-800' : 'text-green-800')}>
            {activeBreaches.length > 0
              ? `${activeBreaches.length} active SLA breach${activeBreaches.length > 1 ? 'es' : ''} right now`
              : 'No active SLA breaches'}
          </p>
          {data && <p className="text-sm text-gray-600 mt-0.5">
            {data.historical_breaches} released containers also breached SLA in this period · SLA threshold: {fmtDwell(slaMin)}
          </p>}
        </div>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-100">
          <RefreshCw size={14} />
        </button>
      </div>

      <ReportTable
        loading={isLoading}
        rows={rows}
        onRowClick={r => onSelectContainer(r.id)}
        rowClassName={r => r.breach_status === 'ACTIVE' ? 'border-l-4 border-red-500 bg-red-50/30' : 'opacity-70'}
        columns={[
          { key: 'breach_status', label: '', render: v => (
            <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
              v === 'ACTIVE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            )}>
              {v === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              {v}
            </span>
          )},
          { key: 'container_number', label: 'Container', render: v => <span className="font-semibold">{v}</span> },
          { key: 'area_name', label: 'Area' },
          { key: 'agent_name', label: 'Agent' },
          { key: 'live_dwell_minutes', label: 'Dwell', render: v => <span className="font-mono font-semibold text-red-700">{fmtDwell(v)}</span> },
          { key: 'minutes_over_sla', label: 'Over SLA', render: v => (
            <span className="font-bold text-red-600">+{fmtDwell(v)}</span>
          )},
          { key: 'start_time', label: 'Check-in', render: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
          { key: 'id', label: '', render: () => <ChevronRight size={14} className="text-gray-400" /> },
        ]}
      />
    </div>
  );
}

// ─── Page 6: Audit Trail ──────────────────────────────────────────────────────
function AuditTab({ filters }) {
  const [params, setParams] = useState({ from: filters.from, to: filters.to, page: 1 });
  const { data, isLoading } = useQuery(
    ['audit', params],
    () => reportsApi.audit(params).then(r => r.data)
  );

  const handleDownload = async () => {
    try {
      const res = await reportsApi.downloadAudit(params);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'audit-trail.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">User</label>
          <input className="input text-sm py-1.5" placeholder="Filter by user…"
            onChange={e => setParams(p => ({ ...p, user: e.target.value, page: 1 }))} /></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
          <input className="input text-sm py-1.5" placeholder="Filter by action…"
            onChange={e => setParams(p => ({ ...p, action: e.target.value, page: 1 }))} /></div>
        <button onClick={handleDownload} className="btn-secondary flex items-center gap-2 text-sm py-1.5">
          <Download size={14} /> Export XLSX
        </button>
      </div>
      <ReportTable
        loading={isLoading}
        rows={data?.rows}
        columns={[
          { key: 'created_at', label: 'Time', render: v => v ? format(new Date(v), 'dd MMM HH:mm:ss') : '—' },
          { key: 'username', label: 'User', render: v => <span className="font-semibold">{v}</span> },
          { key: 'role', label: 'Role' },
          { key: 'action', label: 'Action', render: v => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v}</span> },
          { key: 'entity', label: 'Entity' },
          { key: 'ip_address', label: 'IP' },
        ]}
      />
      {data && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{data.total} total records</span>
          <div className="flex gap-2">
            <button disabled={params.page <= 1}
              onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Prev</button>
            <span className="px-2">Page {params.page}</span>
            <button disabled={data.rows?.length < data.limit}
              onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
              className="btn-secondary text-xs py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ReportsPage ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab]     = useState('dashboard');
  const [filters, setFilters] = useState({ preset: 'today', from: today, to: today });
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting]   = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsApi.export({ from: filters.from, to: filters.to });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `scanport-report-${filters.from}-${filters.to}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch { toast.error('Export failed'); } finally { setExporting(false); }
  };

  // Get sla_minutes for drawer (from dashboard data)
  const { data: dashData } = useQuery(['ops-dashboard'], () => reportsApi.operationsDashboard({}).then(r => r.data));

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 flex items-center gap-0.5 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} onExport={handleExport} exporting={exporting} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'dashboard'  && <DashboardTab  filters={filters} onSelectContainer={setSelectedId} />}
        {tab === 'dwell'      && <DwellTab      filters={filters} onSelectContainer={setSelectedId} />}
        {tab === 'areas'      && <AreasTab      filters={filters} />}
        {tab === 'agents'     && <AgentsTab     filters={filters} />}
        {tab === 'exceptions' && <ExceptionsTab filters={filters} onSelectContainer={setSelectedId} />}
        {tab === 'audit'      && <AuditTab      filters={filters} />}
      </div>

      {/* Container drawer */}
      {selectedId && (
        <ContainerDrawer
          id={selectedId}
          slaMin={dashData?.sla_minutes}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
