import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { containersApi } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LayoutGrid, Database, AlertTriangle, BarChart3,
  CheckSquare, List, HelpCircle, RefreshCw, Search,
  Truck, User, Phone, Clock, LogOut, Container, ChevronDown, X, Printer
} from 'lucide-react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ChitPrintView from '../components/Containers/ChitPrintView';

const TABS = [
  { key: 'allocation', label: 'Bays Allocation', icon: LayoutGrid },
  { key: 'data',       label: 'Bays Data',       icon: Database },
  { key: 'queued',     label: 'Queued',           icon: List },
  { key: 'overstayed', label: 'Overstayed',       icon: AlertTriangle },
  { key: 'released',   label: 'Released',         icon: CheckSquare },
  { key: 'analytics',  label: 'Analytics',        icon: BarChart3 },
];

// Color scheme per status/dwell combination
function bayColor(truck) {
  if (!truck) return null;
  const s = truck.tx_status;
  // Bay Assigned — indigo (truck not yet physically in holding area)
  if (s === 'BAY_ASSIGNED') return {
    bar: 'bg-indigo-500', border: 'border-indigo-300',
    text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800',
    label: 'Bay Assigned', labelCls: 'bg-indigo-100 text-indigo-700',
  };
  // Overstayed — red
  if (truck.dwell_status === 'overstayed') return {
    bar: 'bg-red-500', border: 'border-red-300',
    text: 'text-red-700', badge: 'bg-red-100 text-red-800',
    label: 'Overstayed', labelCls: 'bg-red-100 text-red-700',
  };
  // Warning — amber
  if (truck.dwell_status === 'warning') return {
    bar: 'bg-amber-500', border: 'border-amber-300',
    text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800',
    label: 'In Holding Area', labelCls: 'bg-amber-100 text-amber-700',
  };
  // Checked In (ARRIVED_AT_BAY / UNDER_EXAMINATION / EXAMINATION_COMPLETED) — green
  return {
    bar: 'bg-green-500', border: 'border-green-300',
    text: 'text-green-700', badge: 'bg-green-100 text-green-800',
    label: 'In Holding Area', labelCls: 'bg-green-100 text-green-700',
  };
}

function formatDwell(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Release Confirm Modal ────────────────────────────────────────────────────
function ReleaseModal({ truck, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <LogOut size={16} className="text-green-600" /> Release Truck
          </h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Truck</span><span className="font-bold">{truck.truck_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bay</span><span className="font-semibold">{truck.bay_code}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Driver</span><span>{truck.driver_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Agent</span><span>{truck.agent_name}</span></div>
            {truck.tx_status !== 'BAY_ASSIGNED' && (
              <div className="flex justify-between"><span className="text-gray-500">Time in Bay</span><span className="font-semibold text-orange-600">{formatDwell(truck.dwell_minutes)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Container</span>
              <span className="text-right font-mono text-xs font-bold">{truck.containers?.map(c => c.container_number).join(', ')}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">This will mark the truck as <strong>Released</strong> and free the bay for the next allocation.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => onConfirm(truck.containers?.[0]?.container_number)}
              disabled={loading}
              className="flex-1 btn-primary bg-green-600 hover:bg-green-700 justify-center"
            >
              {loading
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><LogOut size={15} /> Release Bay</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bay Card ─────────────────────────────────────────────────────────────────
function BayCard({ bay, areaName, onRelease, onPrint }) {
  const { truck } = bay;
  const colors = bayColor(truck);

  if (!truck) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 flex flex-col items-center justify-center min-h-[140px] gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <Truck size={14} className="text-gray-400" />
        </div>
        <p className="text-xs font-semibold text-gray-400">{bay.bay_code}</p>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Free</span>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl border-2 overflow-hidden bg-white', colors.border)}>
      {/* Status bar */}
      <div className={clsx('h-1.5', colors.bar)} />

      <div className="p-3 space-y-2">
        {/* Header: bay code + status label + dwell */}
        <div className="flex items-start justify-between gap-1">
          <div className="space-y-1">
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', colors.badge)}>
              {bay.bay_code}
            </span>
            <div>
              <span className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded', colors.labelCls)}>
                {colors.label}
              </span>
            </div>
          </div>
          {truck.tx_status !== 'BAY_ASSIGNED' && (
            <div className="flex items-center gap-1 text-xs shrink-0">
              <Clock size={11} className={colors.text} />
              <span className={clsx('font-semibold', colors.text)}>{formatDwell(truck.dwell_minutes)}</span>
            </div>
          )}
        </div>

        {/* Truck number */}
        <div className="flex items-center gap-1.5">
          <Truck size={13} className="text-gray-500 shrink-0" />
          <span className="text-sm font-bold text-gray-900 truncate">{truck.truck_number}</span>
        </div>

        {/* Containers */}
        <div className="space-y-1">
          {(truck.containers || []).map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
              <Container size={11} className="text-blue-500 shrink-0" />
              <span className="text-xs font-mono font-bold text-gray-800 truncate">{c.container_number}</span>
              <span className={clsx('ml-auto text-xs px-1.5 rounded font-semibold shrink-0',
                c.container_size === '40ft' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              )}>{c.container_size || '20ft'}</span>
            </div>
          ))}
        </div>

        {/* Agent */}
        <div className="pt-1 border-t border-gray-100 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-700">
            <User size={11} className="text-gray-400 shrink-0" />
            <span className="font-semibold truncate">{truck.agent_name}</span>
          </div>
          {truck.agent_phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Phone size={11} className="shrink-0" />
              <span>{truck.agent_phone}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mt-1">
          <button
            onClick={() => onPrint(truck, bay.bay_code, areaName)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <Printer size={11} /> Waybill
          </button>
          {truck.tx_status !== 'BAY_ASSIGNED' && (
            <button
              onClick={() => onRelease(truck, bay.bay_code)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
            >
              <LogOut size={11} /> Release
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Allocation Grid ──────────────────────────────────────────────────────────
function AllocationView({ areas, search, onRelease, onPrint }) {
  return (
    <div className="space-y-8">
      {areas.map(area => {
        const baysToShow = search
          ? area.bays.filter(b =>
              !b.truck ||
              b.truck.truck_number?.toLowerCase().includes(search.toLowerCase()) ||
              b.truck.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
              b.truck.containers?.some(c => c.container_number?.includes(search.toUpperCase()))
            )
          : area.bays;

        return (
          <div key={area.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-6 bg-blue-600 rounded-full" />
              <h2 className="text-base font-bold text-gray-800">{area.name}</h2>
              <span className="text-xs text-gray-400">{area.code}</span>
              <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                <span className="text-green-600 font-semibold">
                  {area.bays.filter(b => !b.truck).length} free
                </span>
                <span className="text-blue-600 font-semibold">
                  {area.bays.filter(b => b.truck).length} occupied
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {baysToShow.map(bay => (
                <BayCard key={bay.id} bay={bay} areaName={area.name} onRelease={onRelease} onPrint={onPrint} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────
function DataView({ areas, onRelease, onPrint }) {
  const rows = areas.flatMap(area =>
    area.bays
      .filter(b => b.truck)
      .map(bay => ({ ...bay.truck, area_name: area.name, bay_code: bay.bay_code }))
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Ref', 'Truck', 'Bay', 'Driver', 'Agent', 'Containers', 'Dwell', 'Actions'].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            )}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!rows.length
              ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No active trucks in holding area</td></tr>
              : rows.map(t => (
                <tr key={t.truck_id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.allocation_ref}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{t.truck_number}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{t.bay_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.driver_name}</p>
                    <p className="text-xs text-gray-400">{t.driver_phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.agent_name}</p>
                    <p className="text-xs text-gray-400">{t.agent_phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {(t.containers || []).map((c, i) => (
                      <div key={i} className="font-mono text-xs font-semibold">{c.container_number} <span className="text-gray-400">{c.container_size}</span></div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('font-semibold',
                      t.dwell_status === 'overstayed' ? 'text-orange-600' : t.dwell_status === 'warning' ? 'text-yellow-600' : 'text-green-600'
                    )}>{formatDwell(t.dwell_minutes)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onPrint(t, t.bay_code, t.area_name)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200">
                        <Printer size={12} /> Waybill
                      </button>
                      <button onClick={() => onRelease(t, t.bay_code)}
                        className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg border border-green-200">
                        <LogOut size={12} /> Release
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Overstayed View ──────────────────────────────────────────────────────────
function OverstayedView({ areas, thresholdHours, onRelease }) {
  const overstayed = areas.flatMap(area =>
    area.bays
      .filter(b => b.truck && b.truck.dwell_status === 'overstayed')
      .map(bay => ({ ...bay.truck, area_name: area.name, bay_code: bay.bay_code }))
  ).sort((a, b) => b.dwell_minutes - a.dwell_minutes);

  if (!overstayed.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <CheckSquare size={40} className="mb-3 text-green-400" />
        <p className="font-semibold">No overstayed trucks</p>
        <p className="text-sm">All trucks are within the {thresholdHours}h threshold</p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {overstayed.map(t => (
        <div key={t.truck_id} className="bg-white rounded-xl border-2 border-orange-300 overflow-hidden">
          <div className="h-1.5 bg-orange-500" />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} /> OVERSTAYED
              </span>
              <span className="text-xs text-gray-400">{t.area_name} · {t.bay_code}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={15} className="text-gray-500" />
              <span className="font-bold text-gray-900 text-base">{t.truck_number}</span>
            </div>
            <p className="text-orange-600 font-semibold text-sm flex items-center gap-1">
              <Clock size={13} /> {formatDwell(t.dwell_minutes)} in holding area
            </p>
            {(t.containers || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <Container size={12} className="text-blue-500" />
                <span className="font-mono font-bold text-sm">{c.container_number}</span>
                <span className="ml-auto text-xs text-gray-400">{c.container_size}</span>
              </div>
            ))}
            <div className="pt-1 border-t border-gray-100 text-sm">
              <p className="font-semibold text-gray-700">{t.agent_name}</p>
              <p className="text-gray-400 text-xs">{t.agent_phone}</p>
            </div>
            <button onClick={() => onRelease(t, t.bay_code)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
              <LogOut size={14} /> Release Truck
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsView({ stats, areas }) {
  const trucks = areas.flatMap(a => a.bays.filter(b => b.truck).map(b => b.truck));
  const lt1h = trucks.filter(t => t.dwell_minutes < 60).length;
  const h1_3 = trucks.filter(t => t.dwell_minutes >= 60 && t.dwell_minutes <= 180).length;
  const gt3h = trucks.filter(t => t.dwell_minutes > 180).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Bays',    value: stats.total_bays,      color: 'border-gray-400' },
          { label: 'Occupied',      value: stats.occupied_bays,   color: 'border-blue-500' },
          { label: 'Free Bays',     value: stats.free_bays,       color: 'border-green-500' },
          { label: 'Active Trucks', value: stats.total_trucks,    color: 'border-blue-500' },
          { label: 'Containers',    value: stats.total_containers, color: 'border-purple-500' },
          { label: 'Overstayed',    value: stats.overstayed,      color: 'border-red-500' },
        ].map(s => (
          <div key={s.label} className={clsx('card p-4 text-center border-t-4', s.color)}>
            <p className="text-2xl font-bold text-gray-900">{s.value ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Occupancy bar */}
      <div className="card p-5">
        <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
          <span>Bay Occupancy</span>
          <span>{stats.occupied_bays}/{stats.total_bays}</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: stats.total_bays > 0 ? `${(stats.occupied_bays / stats.total_bays) * 100}%` : '0%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {stats.total_bays > 0 ? Math.round((stats.occupied_bays / stats.total_bays) * 100) : 0}% occupied
        </p>
      </div>

      {/* Dwell breakdown */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Dwell Time Distribution</h3>
        <div className="space-y-3">
          {[
            { label: '< 1 hour',  count: lt1h, color: 'bg-green-500' },
            { label: '1–3 hours', count: h1_3, color: 'bg-yellow-500' },
            { label: '> 3 hours', count: gt3h, color: 'bg-orange-500' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-20">{row.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className={clsx('h-full rounded-full', row.color)}
                  style={{ width: trucks.length > 0 ? `${(row.count / trucks.length) * 100}%` : '0%' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-5 text-right">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-area */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Area Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            {['Area', 'Total Bays', 'Occupied', 'Free', 'Utilisation'].map(h =>
              <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            )}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {areas.map(area => {
              const total    = area.bays.length;
              const occupied = area.bays.filter(b => b.truck).length;
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              return (
                <tr key={area.id}>
                  <td className="px-4 py-3 font-medium">{area.name}</td>
                  <td className="px-4 py-3 text-gray-600">{total}</td>
                  <td className="px-4 py-3 text-gray-600">{occupied}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">{total - occupied}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={clsx('h-full rounded-full', pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500')}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BaysPage() {
  const [tab, setTab]             = useState('allocation');
  const [search, setSearch]       = useState('');
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [printChit, setPrintChit] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery(
    ['bays-view', tab],
    () => containersApi.baysView({ tab }).then(r => r.data),
    { refetchInterval: 20000 }
  );

  const releaseMutation = useMutation(
    (containerNumber) => containersApi.confirmExit({ containerNumber }),
    {
      onSuccess: (res) => {
        toast.success(res.data.message || 'Truck released.');
        setReleaseTarget(null);
        refetch();
        qc.invalidateQueries('dashboard');
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Release failed.'),
    }
  );

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });
    socket.on('transaction:new',     () => refetch());
    socket.on('transaction:updated', () => refetch());
    return () => socket.disconnect();
  }, [refetch]);

  const areas = data?.areas || [];
  const stats = data?.stats || {};

  const handleRelease = (truck, bayCode) => {
    setReleaseTarget({ ...truck, bay_code: bayCode });
  };

  const handlePrint = (truck, bayCode, areaName) => {
    setPrintChit({
      transaction_id:   truck.allocation_ref || '—',
      container_number: truck.containers?.[0]?.container_number || truck.truck_number,
      agent_name:       truck.agent_name,
      agent_phone:      truck.agent_phone,
      truck_number:     truck.truck_number,
      area_name:        areaName,
      bay_code:         bayCode,
      qr_code_token:    truck.qr_token || null,
      created_at:       new Date().toISOString(),
    });
  };

  const tabAreas = tab === 'overstayed'
    ? areas.map(a => ({ ...a, bays: a.bays.filter(b => b.truck?.dwell_status === 'overstayed') }))
    : areas;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 flex items-center gap-0.5 overflow-x-auto shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            )}>
            <t.icon size={15} />
            {t.label}
            {t.key === 'overstayed' && stats.overstayed > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">{stats.overstayed}</span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search truck, container, agent..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />Bay Assigned</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-full" />Checked In</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />Warning</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-full" />Overstayed</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 border-2 border-dashed border-gray-300 rounded-full" />Free</span>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm py-1.5"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-2 flex items-center gap-6 text-sm shrink-0 overflow-x-auto">
        <span className="text-gray-500 whitespace-nowrap">Bays: <strong className="text-gray-900">{stats.occupied_bays || 0}/{stats.total_bays || 0}</strong></span>
        <span className="text-green-600 whitespace-nowrap">Free: <strong>{stats.free_bays || 0}</strong></span>
        <span className="text-blue-600 whitespace-nowrap">Trucks: <strong>{stats.total_trucks || 0}</strong></span>
        <span className="text-purple-600 whitespace-nowrap">Containers: <strong>{stats.total_containers || 0}</strong></span>
        {stats.overstayed > 0 && <span className="text-orange-600 font-semibold whitespace-nowrap">⚠ Overstayed: <strong>{stats.overstayed}</strong></span>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : tab === 'allocation' || tab === 'queued' ? (
          <AllocationView areas={tabAreas} search={search} onRelease={handleRelease} onPrint={handlePrint} />
        ) : tab === 'data' ? (
          <DataView areas={areas} onRelease={handleRelease} onPrint={handlePrint} />
        ) : tab === 'overstayed' ? (
          <OverstayedView areas={tabAreas} thresholdHours={stats.threshold_hours} onRelease={handleRelease} />
        ) : tab === 'released' ? (
          <ReleasedView released={data?.released || []} />
        ) : tab === 'analytics' ? (
          <AnalyticsView stats={stats} areas={areas} />
        ) : null}
      </div>

      {/* Release modal */}
      {releaseTarget && (
        <ReleaseModal
          truck={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onConfirm={(id) => releaseMutation.mutate(id)}
          loading={releaseMutation.isLoading}
        />
      )}

      {/* Waybill print modal */}
      {printChit && <ChitPrintView transaction={printChit} onClose={() => setPrintChit(null)} />}
    </div>
  );
}

// ─── Released History ─────────────────────────────────────────────────────────
function ReleasedView({ released }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Txn ID', 'Container', 'Truck', 'Bay', 'Agent', 'Time In', 'Time Out', 'Dwell'].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            )}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!released.length
              ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No released trucks</td></tr>
              : released.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.transaction_id}</td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{t.container_number}</td>
                  <td className="px-4 py-3 font-semibold">{t.truck_number || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {t.area_name} · {t.bay_code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.agent_name}</p>
                    <p className="text-xs text-gray-400">{t.agent_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.bay_entry_time ? format(new Date(t.bay_entry_time), 'dd MMM HH:mm') : t.time_in ? format(new Date(t.time_in), 'dd MMM HH:mm') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.time_out ? format(new Date(t.time_out), 'dd MMM HH:mm') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                      {formatDwell(t.dwell_minutes)}
                    </span>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
