import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { containersApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import StatusBadge from '../components/Containers/StatusBadge';
import { QRCodeSVG } from 'qrcode.react';
import {
  ScanLine, LogOut,
  Search, AlertTriangle,
  User, Truck, Phone, MapPin, Hash, ClipboardCheck
} from 'lucide-react';
import clsx from 'clsx';

// ─── Lookup input ─────────────────────────────────────────────────────────────
function LookupInput({ onFound, placeholder, expectedStatus }) {
  const [input, setInput] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);

  const mutation = useMutation(
    (q) => containersApi.get(q).then(r => r.data),
    {
      onSuccess: (data) => {
        if (expectedStatus && data.status !== expectedStatus) {
          toast.error(`Expected ${expectedStatus.replace(/_/g, ' ')}, current status is ${data.status.replace(/_/g, ' ')}.`);
        } else {
          onFound?.(data);
        }
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Not found.'),
    }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    if (!v) return;
    mutation.mutate(v);
  };

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        ref={ref}
        className="input flex-1 font-mono text-base h-12"
        placeholder={placeholder || 'Container / waybill / transaction ID'}
        value={input}
        onChange={e => setInput(e.target.value.toUpperCase())}
        autoComplete="off"
      />
      <button type="submit" disabled={mutation.isLoading || !input.trim()} className="btn-primary px-4">
        {mutation.isLoading
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <Search size={18} />}
      </button>
    </form>
  );
}

// ─── Chit detail card (shown before confirmation) ─────────────────────────────
function ChitCard({ txn }) {
  if (!txn) return null;
  const verifyUrl = txn.qr_code_token ? `/api/containers/verify/${txn.qr_code_token}` : null;

  return (
    <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
      {/* QR + bay header */}
      <div className="bg-blue-50 px-4 py-3 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono font-bold text-xl text-gray-900">{txn.container_number}</p>
          {txn.waybill_number && (
            <p className="font-mono text-xs text-gray-500">WB: {txn.waybill_number}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin size={13} className="text-blue-600" />
            <span className="font-semibold text-blue-700 text-sm">
              {txn.area_name} · Bay {txn.bay_code}
            </span>
          </div>
          <StatusBadge status={txn.status} />
        </div>
        {verifyUrl && (
          <div className="p-2 bg-white border border-gray-200 rounded-lg shrink-0">
            <QRCodeSVG value={verifyUrl} size={80} level="M" />
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Detail icon={Hash}  label="Txn ID"       value={txn.transaction_id} mono />
        <Detail icon={Truck} label="Truck"         value={txn.truck_number || '—'} />
        <Detail icon={User}  label="Driver"        value={txn.driver_name  || '—'} />
        <Detail icon={Phone} label="Driver Phone"  value={txn.driver_phone || '—'} />
        <Detail icon={User}  label="Agent"         value={txn.agent_name} />
        <Detail icon={Phone} label="Agent Phone"   value={txn.agent_phone} />
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Icon size={10} /> {label}
      </p>
      <p className={clsx('text-sm font-semibold text-gray-900 truncate', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  );
}

// ─── Transaction summary card (compact, for later steps) ─────────────────────
function TxnCard({ txn }) {
  if (!txn) return null;
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-gray-900 text-base">{txn.container_number}</span>
        <StatusBadge status={txn.status} />
      </div>
      {txn.waybill_number && <Row icon={Hash} label="Waybill"     value={txn.waybill_number} mono />}
      <Row icon={Truck}  label="Truck"         value={txn.truck_number || '—'} />
      <Row icon={User}   label="Agent"         value={txn.agent_name} />
      {txn.bay_code && <Row icon={MapPin} label="Bay" value={`${txn.area_name || ''} · Bay ${txn.bay_code}`} />}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon size={13} className="text-gray-400 shrink-0" /> : <span className="w-[13px]" />}
      <span className="text-gray-500 w-28 shrink-0 text-xs">{label}</span>
      <span className={clsx('font-medium text-gray-900 text-sm', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

// ─── Success banner ───────────────────────────────────────────────────────────
function SuccessBanner({ icon: Icon, color, title, lines }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };
  return (
    <div className={clsx('rounded-xl p-4 border flex items-start gap-3', colors[color])}>
      <Icon size={20} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">{title}</p>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className="text-sm mt-0.5 opacity-80">{l}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Step 0: Gate Check-In / Confirm Chit ────────────────────────────────────
function GateCheckInPanel() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data, isLoading, refetch } = useQuery(
    'bay-assigned-queue',
    () => containersApi.list({ status: 'BAY_ASSIGNED', limit: 50 }).then(r => r.data),
    { refetchInterval: 10000 }
  );

  const mutation = useMutation(
    (containerNumber) => containersApi.confirmEntry({ containerNumber }),
    {
      onSuccess: () => {
        toast.success('Truck checked in to holding area!');
        setSelected(null);
        qc.invalidateQueries('bay-assigned-queue');
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Check-in failed.'),
    }
  );

  const queue = data?.transactions || [];

  return (
    <div className="space-y-4">
      {/* Queue header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">
          Trucks with bay assigned, awaiting check-in
          {queue.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {queue.length}
            </span>
          )}
        </p>
        <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
          <Search size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : !queue.length ? (
        <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          No trucks waiting to check in.
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(t => (
            <div key={t.id} className={clsx(
              'rounded-xl border-2 p-4 transition-all',
              selected?.id === t.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            )}>
              {/* Summary row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-gray-900">{t.container_number}</span>
                    {t.waybill_number && <span className="font-mono text-xs text-gray-400">{t.waybill_number}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {t.truck_number && <span className="flex items-center gap-1"><Truck size={10}/>{t.truck_number}</span>}
                    <span className="flex items-center gap-1"><MapPin size={10}/>{t.area_name || '—'} · Bay {t.bay_code || '—'}</span>
                    <span className="flex items-center gap-1"><User size={10}/>{t.agent_name}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Assigned {t.bay_assigned_time ? format(new Date(t.bay_assigned_time), 'dd MMM HH:mm') : '—'}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(selected?.id === t.id ? null : t)}
                  className={clsx(
                    'shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                    selected?.id === t.id
                      ? 'bg-gray-100 border-gray-300 text-gray-600'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  )}
                >
                  {selected?.id === t.id ? 'Cancel' : 'Check In'}
                </button>
              </div>

              {/* Expanded chit + confirm */}
              {selected?.id === t.id && (
                <div className="mt-4 space-y-3 pt-4 border-t border-blue-200">
                  <ChitCard txn={t} />
                  <button
                    onClick={() => mutation.mutate(t.container_number)}
                    disabled={mutation.isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                               flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {mutation.isLoading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><ClipboardCheck size={18} /> Confirm &amp; Check Truck Into Holding Area</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Release Truck ────────────────────────────────────────────────────
function ReleaseTruckPanel() {
  const [txn, setTxn]   = useState(null);
  const [done, setDone] = useState(null);

  const mutation = useMutation(
    (data) => containersApi.confirmExit(data),
    {
      onSuccess: (res) => { toast.success('Truck released!'); setDone(res.data); setTxn(null); },
      onError: (err) => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const handleFound = (t) => {
    const allowed = ['ARRIVED_AT_BAY', 'UNDER_EXAMINATION', 'EXAMINATION_COMPLETED'];
    if (!allowed.includes(t.status)) {
      toast.error(`Truck must be in the holding area. Current status: ${t.status}`);
      return;
    }
    setTxn(t); setDone(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Confirm the truck is cleared and record exit from the holding area.</p>
      <LookupInput onFound={handleFound} placeholder="Container / waybill / transaction ID" />

      {txn && (
        <div className="space-y-3">
          <TxnCard txn={txn} />
          <button
            onClick={() => mutation.mutate({ containerNumber: txn.container_number })}
            disabled={mutation.isLoading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl
                       flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {mutation.isLoading
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><LogOut size={18} /> Release Truck &amp; Confirm Exit</>}
          </button>
        </div>
      )}

      {done && <SuccessBanner icon={LogOut} color="green" title="Truck Released" lines={[
        `Container: ${done.containerNumber || done.container_number}`,
        `Waybill: ${done.waybillNumber || '—'}`,
        done.dwellMinutes !== undefined ? `Total dwell: ${done.dwellMinutes} min` : null,
      ]} />}
    </div>
  );
}

// ─── Steps config ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    key:   'checkin',
    label: 'Truck Check-In',
    icon:  ClipboardCheck,
    color: 'blue',
    from:  'BAY_ASSIGNED',
    to:    'ARRIVED_AT_BAY',
    desc:  'Confirm chit & check truck in',
  },
  {
    key:   'release',
    label: 'Release Truck',
    icon:  LogOut,
    color: 'green',
    from:  'ARRIVED_AT_BAY',
    to:    'EXITED',
    desc:  'Confirm exit',
  },
];

const stepColors = {
  blue:  { active: 'bg-blue-600 text-white border-blue-600',   icon: 'bg-blue-600' },
  green: { active: 'bg-green-600 text-white border-green-600', icon: 'bg-green-600' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HoldingAreaPage() {
  const [step, setStep] = useState('checkin');
  const current = STEPS.find(s => s.key === step);

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ScanLine size={20} className="text-blue-600" /> Holding Area
        </h1>
        <p className="text-sm text-gray-500 mt-1">Truck check-in and release workflow.</p>
      </div>

      {/* Step selector */}
      <div className="grid grid-cols-2 gap-2">
        {STEPS.map((s) => {
          const isActive = step === s.key;
          const colors   = stepColors[s.color];
          return (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={clsx(
                'flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left',
                isActive
                  ? `${colors.active} shadow-md`
                  : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={14} />
                <span className="text-xs font-bold leading-tight">{s.label}</span>
              </div>
              <span className={clsx('text-xs leading-tight', isActive ? 'opacity-75' : 'text-gray-400')}>
                {s.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', stepColors[current.color].icon)}>
            <current.icon size={17} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{current.label}</p>
            <p className="text-xs text-gray-400 font-mono">{current.from} → {current.to}</p>
          </div>
        </div>

        {step === 'checkin' && <GateCheckInPanel />}
        {step === 'release' && <ReleaseTruckPanel />}
      </div>

    </div>
  );
}
