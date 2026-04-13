import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { trucksApi, containersApi } from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/Containers/StatusBadge';
import ChitPrintView from '../components/Containers/ChitPrintView';
import {
  Truck, Plus, Trash2, AlertCircle, CheckCircle,
  User, Phone, Container, MapPin, Clock, RefreshCw, Printer
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const CONTAINER_REGEX = /^[A-Z]{4}\d{7}$/;
const EMPTY_CONTAINER = { number: '', size: '20ft' };

function validateLoad(containers) {
  if (containers.length > 2) return 'Maximum 2 containers per truck.';
  if (containers.length === 2) {
    const has40 = containers.some(c => c.size === '40ft');
    if (has40) return 'Two containers must both be 20ft. A 40ft container must be loaded alone.';
  }
  return null;
}

// ─── Container number input row ───────────────────────────────────────────────
function ContainerInput({ index, value, onChange, onRemove, canRemove, error }) {
  const isValid = CONTAINER_REGEX.test(value.number);
  return (
    <div className={clsx('rounded-xl border-2 p-4 space-y-3 transition-colors',
      error ? 'border-red-300 bg-red-50'
            : isValid && value.number ? 'border-green-300 bg-green-50'
            : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Container size={15} className="text-blue-500" /> Container {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
            {['20ft', '40ft'].map(s => (
              <button key={s} type="button" onClick={() => onChange({ ...value, size: s })}
                className={clsx('px-3 py-1.5 transition-colors',
                  value.size === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {s}
              </button>
            ))}
          </div>
          {canRemove && (
            <button type="button" onClick={onRemove}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          className={clsx('input font-mono uppercase tracking-widest text-base', error && 'border-red-400 focus:ring-red-400')}
          placeholder="e.g. HLBU2304692"
          value={value.number}
          onChange={e => onChange({ ...value, number: e.target.value.toUpperCase() })}
          maxLength={11}
        />
        {value.number && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
      {!error && value.number && !isValid && (
        <p className="text-xs text-red-400">Format: 4 uppercase letters + 7 digits (e.g. HLBU2304692)</p>
      )}
    </div>
  );
}

// ─── Pending arrivals queue ───────────────────────────────────────────────────
function PendingQueue({ onChitReady }) {
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState(null);
  const [areaId, setAreaId]       = useState('');

  const { data: pending, isLoading, refetch } = useQuery(
    'pending-bay-assignment',
    () => containersApi.list({ status: 'ARRIVED_AT_BOOTH,PENDING_BAY_ASSIGNMENT', limit: 50 }).then(r => r.data),
    { refetchInterval: 15000 }
  );

  const { data: areasData } = useQuery(
    'holding-areas',
    () => containersApi.holdingAreas().then(r => r.data)
  );

  const assignMutation = useMutation(
    ({ id, holdingAreaId }) => containersApi.assignBay(id, { holdingAreaId: holdingAreaId || undefined }),
    {
      onSuccess: (res) => {
        const t = res.data;
        toast.success(`Bay ${t.bay_code} assigned — chit ready to print.`);
        setAssigning(null);
        setAreaId('');
        qc.invalidateQueries('pending-bay-assignment');
        qc.invalidateQueries('holding-areas');
        // Open chit immediately
        onChitReady(t);
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Bay assignment failed.'),
    }
  );

  const list = pending?.transactions || [];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-amber-50">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            Pending Bay Assignment
            {list.length > 0 && (
              <span className="ml-2 bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {list.length}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => refetch()} className="text-amber-500 hover:text-amber-700 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
        </div>
      ) : !list.length ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">No trucks waiting for bay assignment.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {list.map(t => (
            <div key={t.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-gray-900">{t.container_number}</span>
                    {t.waybill_number && <span className="font-mono text-xs text-gray-400">{t.waybill_number}</span>}
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.truck_number && <><Truck size={10} className="inline mr-0.5" />{t.truck_number} · </>}
                    <User size={10} className="inline mr-0.5" />{t.agent_name}
                    {t.agent_phone && ` · ${t.agent_phone}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Clock size={10} className="inline mr-0.5" />
                    Arrived {format(new Date(t.created_at), 'dd MMM HH:mm')}
                  </p>
                </div>

                {assigning?.id === t.id ? (
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <select
                      className="input text-xs py-1 px-2 h-8 w-44"
                      value={areaId}
                      onChange={e => setAreaId(e.target.value)}
                    >
                      <option value="">Auto-assign area</option>
                      {(areasData || []).map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.occupied}/{a.total_bays})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignMutation.mutate({ id: t.id, holdingAreaId: areaId })}
                      disabled={assignMutation.isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg
                                 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {assignMutation.isLoading
                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><MapPin size={12} /> Assign &amp; Print Chit</>}
                    </button>
                    <button
                      onClick={() => { setAssigning(null); setAreaId(''); }}
                      className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1.5 rounded-lg border border-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAssigning(t); setAreaId(''); }}
                    className="shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold
                               px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                  >
                    <MapPin size={12} /> Assign Bay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BayAllocationPage() {
  // Chit state — shared across both flows
  const [chit, setChit] = useState(null);

  const [form, setForm] = useState({
    truckNumber: '', driverName: '', driverPhone: '',
    agentName: '', agentPhone: '',
    containers: [{ ...EMPTY_CONTAINER }],
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const { data: baysData } = useQuery(
    'available-bays',
    () => trucksApi.availableBays({}).then(r => r.data),
    { refetchInterval: 15000 }
  );

  const mutation = useMutation(trucksApi.create, {
    onSuccess: (res) => {
      const alloc = res.data;
      toast.success(`Truck ${alloc.truck_number} allocated to ${alloc.bay_code} — chit ready.`);
      // Shape allocation result into a chit-compatible object
      setChit({
        transaction_id:   alloc.allocation_ref,
        container_number: alloc.containers?.[0]?.container_number || alloc.truck_number,
        agent_name:       alloc.agent_name   || form.agentName,
        agent_phone:      alloc.agent_phone  || form.agentPhone,
        truck_number:     alloc.truck_number,
        area_name:        alloc.area_name,
        bay_code:         alloc.bay_code,
        qr_code_token:    alloc.qr_token || null,
        created_at:       alloc.created_at || new Date().toISOString(),
      });
      setForm({
        truckNumber: '', driverName: '', driverPhone: '',
        agentName: '', agentPhone: '',
        containers: [{ ...EMPTY_CONTAINER }],
      });
      setFieldErrors({});
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Allocation failed.'),
  });

  const loadError = validateLoad(form.containers);

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    let invalid = false;
    form.containers.forEach((c, i) => {
      if (!CONTAINER_REGEX.test(c.number)) { errors[`cn_${i}`] = 'Invalid format.'; invalid = true; }
    });
    if (invalid)               { setFieldErrors(errors); return; }
    if (loadError)             { toast.error(loadError); return; }
    if (!form.truckNumber.trim()) { toast.error('Truck number is required.'); return; }
    if (!form.driverName.trim())  { toast.error('Driver name is required.'); return; }
    if (!form.driverPhone.trim()) { toast.error('Driver phone is required.'); return; }
    if (!form.agentName.trim())   { toast.error('Agent name is required.'); return; }
    if (!form.agentPhone.trim())  { toast.error('Agent phone is required.'); return; }

    mutation.mutate({
      truckNumber:   form.truckNumber.trim().toUpperCase(),
      driverName:    form.driverName.trim(),
      driverPhone:   form.driverPhone.trim(),
      agentName:     form.agentName.trim(),
      agentPhone:    form.agentPhone.trim(),
      containers:    form.containers.map(c => ({ number: c.number, size: c.size })),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" /> Bay Allocation
          </h1>
          <p className="text-sm text-gray-500 mt-1">Assign bays to checked-in trucks and issue digital chits.</p>
        </div>
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border',
          baysData?.free === 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        )}>
          <span className={clsx('w-2 h-2 rounded-full', baysData?.free === 0 ? 'bg-red-500' : 'bg-green-500')} />
          {baysData ? `${baysData.free} / ${baysData.total} bays free` : 'Loading…'}
        </div>
      </div>

      {/* Pending queue — gate check-ins awaiting bay */}
      <PendingQueue onChitReady={setChit} />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Direct Allocation</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Full bay warning */}
      {baysData?.free === 0 && (
        <div className="card p-4 bg-red-50 border-red-300 border-2 flex items-start gap-3">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-800">All bays are currently full</p>
            <p className="text-sm text-red-600 mt-0.5">No new trucks can be allocated until a bay is released.</p>
          </div>
        </div>
      )}

      {/* Direct allocation form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Truck */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-blue-700 flex items-center gap-2">
            <Truck size={15} /> Truck Details
          </h2>
          <div>
            <label className="label">Truck Number *</label>
            <input className="input uppercase font-mono" placeholder="e.g. GR-1234-20"
              value={form.truckNumber}
              onChange={e => setForm(f => ({ ...f, truckNumber: e.target.value.toUpperCase() }))} required />
          </div>
        </div>

        {/* Driver */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-blue-700 flex items-center gap-2">
            <User size={15} /> Driver Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Driver Name *</label>
              <input className="input" placeholder="Full name" value={form.driverName}
                onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Driver Phone *</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="+233 244 000 000" value={form.driverPhone}
                  onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} required />
              </div>
            </div>
          </div>
        </div>

        {/* Agent */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-blue-700 flex items-center gap-2">
            <User size={15} /> Agent Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Agent Name *</label>
              <input className="input" placeholder="Full name" value={form.agentName}
                onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Agent Phone *</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="+233 244 000 000" value={form.agentPhone}
                  onChange={e => setForm(f => ({ ...f, agentPhone: e.target.value }))} required />
              </div>
            </div>
          </div>
        </div>

        {/* Containers */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-blue-700 flex items-center gap-2">
              <Container size={15} /> Containers
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Max: 2×20ft &nbsp;|&nbsp; 1×40ft alone</span>
              {form.containers.length < 2 && (
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, containers: [...f.containers, { ...EMPTY_CONTAINER }] }))}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold">
                  <Plus size={14} /> Add Container
                </button>
              )}
            </div>
          </div>
          {loadError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertCircle size={15} /> {loadError}
            </div>
          )}
          <div className="space-y-3">
            {form.containers.map((c, i) => (
              <ContainerInput key={i} index={i} value={c}
                onChange={val => {
                  setForm(f => { const cs = [...f.containers]; cs[i] = val; return { ...f, containers: cs }; });
                  setFieldErrors(e => ({ ...e, [`cn_${i}`]: null }));
                }}
                onRemove={() => setForm(f => ({ ...f, containers: f.containers.filter((_, idx) => idx !== i) }))}
                canRemove={form.containers.length > 1}
                error={fieldErrors[`cn_${i}`]}
              />
            ))}
          </div>
        </div>

        {/* Submit → allocate + print chit */}
        <button
          type="submit"
          disabled={mutation.isLoading || !!loadError || baysData?.free === 0}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {mutation.isLoading
            ? <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Printer size={18} /> Allocate Bay &amp; Print Chit</>}
        </button>
      </form>

      {/* Chit modal — opened by both flows */}
      {chit && <ChitPrintView transaction={chit} onClose={() => setChit(null)} />}
    </div>
  );
}
