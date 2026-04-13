import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { containersApi } from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/Containers/StatusBadge';
import {
  Shield, Truck, User, Phone, Hash,
  CheckCircle, AlertCircle, Clock, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const CONTAINER_REGEX = /^[A-Z]{4}\d{7}$/;

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionHead({ label }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Success card ─────────────────────────────────────────────────────────────
function SuccessCard({ txn, onNew }) {
  return (
    <div className="card border-blue-200 bg-blue-50/40 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
          <CheckCircle size={20} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-blue-800 text-lg">Truck Checked In</p>
          <p className="text-sm text-blue-600 flex items-center gap-1">
            Awaiting bay assignment <ArrowRight size={13} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <InfoRow icon={Hash}   label="Transaction"  value={txn.transaction_id} mono />
        <InfoRow icon={Hash}   label="Container"    value={txn.container_number} mono />
        {txn.waybill_number && <InfoRow icon={Hash} label="Waybill" value={txn.waybill_number} mono />}
        <InfoRow icon={Truck}  label="Truck"        value={txn.truck_number || '—'} />
        <InfoRow icon={User}   label="Driver"       value={txn.driver_name  || '—'} />
        <InfoRow icon={Phone}  label="Driver Phone" value={txn.driver_phone || '—'} />
        <InfoRow icon={User}   label="Agent"        value={txn.agent_name} />
        <InfoRow icon={Phone}  label="Agent Phone"  value={txn.agent_phone} />
      </div>

      <div className="bg-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
        <Clock size={12} /> Bay will be assigned by the allocation officer.
      </div>

      <button onClick={onNew} className="w-full btn-primary justify-center py-2.5">
        <CheckCircle size={15} /> Check In Next Truck
      </button>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
        <Icon size={10} /> {label}
      </p>
      <p className={clsx('text-sm font-semibold text-gray-900 truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

// ─── Recent check-ins list ────────────────────────────────────────────────────
function RecentCheckIns() {
  const { data } = useQuery(
    'gate-checkins',
    () => containersApi.list({
      limit: 10,
      status: 'ARRIVED_AT_BOOTH,PENDING_BAY_ASSIGNMENT,BAY_ASSIGNED',
    }).then(r => r.data),
    { refetchInterval: 20000 }
  );

  const list = data?.transactions || [];
  if (!list.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
        <Clock size={14} className="text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">Recent Check-Ins</p>
      </div>
      <div className="divide-y divide-gray-50">
        {list.map(t => (
          <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm text-gray-900">{t.container_number}</span>
                {t.waybill_number && (
                  <span className="font-mono text-xs text-gray-400">{t.waybill_number}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">
                {t.truck_number && `${t.truck_number} · `}{t.agent_name}
              </p>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge status={t.status} />
              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(t.created_at), 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarshalGatePage() {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    waybillNumber:   '',
    containerNumber: '',
    agentName:       '',
    agentPhone:      '',
    truckNumber:     '',
    driverName:      '',
    driverPhone:     '',
  });
  const [cnError, setCnError] = useState('');
  const [result, setResult]   = useState(null);

  const mutation = useMutation(containersApi.checkIn, {
    onSuccess: (res) => {
      toast.success('Truck checked in — awaiting bay assignment.');
      setResult(res.data);
      qc.invalidateQueries('gate-checkins');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Check-in failed.'),
  });

  const set = (key) => (e) => {
    const upper = ['waybillNumber', 'containerNumber', 'truckNumber'].includes(key);
    const val = upper ? e.target.value.toUpperCase() : e.target.value;
    setForm(f => ({ ...f, [key]: val }));
    if (key === 'containerNumber') {
      const u = e.target.value.toUpperCase();
      setCnError(u && !CONTAINER_REGEX.test(u) ? 'Format: 4 letters + 7 digits (e.g. HLBU2304692)' : '');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!CONTAINER_REGEX.test(form.containerNumber)) {
      return toast.error('Invalid container number format.');
    }
    mutation.mutate({
      waybillNumber:   form.waybillNumber   || undefined,
      containerNumber: form.containerNumber,
      agentName:       form.agentName,
      agentPhone:      form.agentPhone,
      truckNumber:     form.truckNumber     || undefined,
      driverName:      form.driverName      || undefined,
      driverPhone:     form.driverPhone     || undefined,
    });
  };

  const handleNew = () => {
    setResult(null);
    setForm({ waybillNumber:'', containerNumber:'', agentName:'', agentPhone:'', truckNumber:'', driverName:'', driverPhone:'' });
    setCnError('');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={20} className="text-green-600" /> Marshal Gate — Truck Check-In
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Register truck arrival details at the gate. Bay assignment is handled separately.
        </p>
      </div>

      {result ? (
        <SuccessCard txn={result} onNew={handleNew} />
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">

          <SectionHead label="Document Details" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Waybill Number">
              <input
                className="input font-mono uppercase"
                placeholder="e.g. WB-20260408-001"
                value={form.waybillNumber}
                onChange={set('waybillNumber')}
              />
            </Field>
            <Field label="Container Number" required error={cnError}>
              <input
                className={clsx('input font-mono uppercase', cnError && 'border-red-400 focus:ring-red-400')}
                placeholder="e.g. HLBU2304692"
                value={form.containerNumber}
                onChange={set('containerNumber')}
                maxLength={11}
                required
              />
            </Field>
          </div>

          <SectionHead label="Shipping Agent" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Agent Name" required>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="Full name"
                  value={form.agentName} onChange={set('agentName')} required />
              </div>
            </Field>
            <Field label="Agent Phone" required>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="+233 244 000 000"
                  value={form.agentPhone} onChange={set('agentPhone')} required />
              </div>
            </Field>
          </div>

          <SectionHead label="Truck & Driver" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Truck Number" required>
              <div className="relative">
                <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 uppercase" placeholder="e.g. GR-5678-21"
                  value={form.truckNumber} onChange={set('truckNumber')} required />
              </div>
            </Field>
            <Field label="Driver Name">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="Driver full name"
                  value={form.driverName} onChange={set('driverName')} />
              </div>
            </Field>
            <Field label="Driver Phone">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="+233 …"
                  value={form.driverPhone} onChange={set('driverPhone')} />
              </div>
            </Field>
          </div>

          <button
            type="submit"
            disabled={mutation.isLoading || !!cnError}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl
                       flex items-center justify-center gap-2 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isLoading
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Shield size={18} /> Check In Truck</>}
          </button>
        </form>
      )}

      <RecentCheckIns />
    </div>
  );
}
