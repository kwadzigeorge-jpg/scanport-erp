import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { containersApi } from '../services/api';
import toast from 'react-hot-toast';
import ChitPrintView from '../components/Containers/ChitPrintView';
import StatusBadge from '../components/Containers/StatusBadge';
import { Ticket, AlertCircle, Search, MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const CONTAINER_REGEX = /^[A-Z]{4}\d{7}$/;

// ─── Step 1: Check-In Form ────────────────────────────────────────────────────
function CheckInForm({ onSuccess }) {
  const [form, setForm] = useState({
    waybillNumber: '', containerNumber: '', agentName: '', agentPhone: '', truckNumber: '',
  });
  const [cnError, setCnError] = useState('');

  const mutation = useMutation(containersApi.checkIn, {
    onSuccess: (res) => {
      toast.success('Agent checked in. Assign a bay to generate chit.');
      onSuccess(res.data);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Check-in failed.'),
  });

  const validateCN = (val) => {
    const upper = val.toUpperCase();
    if (!upper) { setCnError(''); return upper; }
    if (!CONTAINER_REGEX.test(upper)) {
      setCnError('Format: 4 uppercase letters + 7 digits (e.g. HLBU2304692)');
    } else {
      setCnError('');
    }
    return upper;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!CONTAINER_REGEX.test(form.containerNumber)) {
      return toast.error('Invalid container number format.');
    }
    mutation.mutate(form);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
        <div>
          <h2 className="font-semibold text-gray-900">Agent Check-In</h2>
          <p className="text-xs text-gray-500">Register waybill and container details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Waybill */}
        <div>
          <label className="label">Waybill Number *</label>
          <input
            className="input font-mono uppercase"
            placeholder="e.g. WB-20260408-001"
            value={form.waybillNumber}
            onChange={e => setForm(f => ({ ...f, waybillNumber: e.target.value.toUpperCase() }))}
            required
          />
        </div>

        {/* Container Number */}
        <div>
          <label className="label">Container Number *</label>
          <input
            className={clsx('input font-mono uppercase', cnError && 'border-red-400 focus:ring-red-400')}
            placeholder="e.g. HLBU2304692"
            value={form.containerNumber}
            onChange={e => setForm(f => ({ ...f, containerNumber: validateCN(e.target.value) }))}
            maxLength={11}
            required
          />
          {cnError && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
              <AlertCircle size={12} /> {cnError}
            </p>
          )}
        </div>

        {/* Agent Name */}
        <div>
          <label className="label">Agent Name *</label>
          <input className="input" placeholder="Full name" value={form.agentName}
            onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} required />
        </div>

        {/* Agent Phone */}
        <div>
          <label className="label">Agent Phone *</label>
          <input className="input" placeholder="+233 244 000 000" value={form.agentPhone}
            onChange={e => setForm(f => ({ ...f, agentPhone: e.target.value }))} required />
        </div>

        {/* Truck Number */}
        <div>
          <label className="label">Truck Number <span className="text-gray-400">(optional)</span></label>
          <input className="input uppercase" placeholder="e.g. GR-5678-21" value={form.truckNumber}
            onChange={e => setForm(f => ({ ...f, truckNumber: e.target.value.toUpperCase() }))} />
        </div>

        <button type="submit" disabled={mutation.isLoading || !!cnError}
          className="btn-primary w-full justify-center py-2.5">
          {mutation.isLoading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><CheckCircle size={16} /> Register Check-In</>
          }
        </button>
      </form>
    </div>
  );
}

// ─── Step 2: Bay Assignment Form ──────────────────────────────────────────────
function BayAssignForm({ transaction, onSuccess, onCancel }) {
  const [holdingAreaId, setHoldingAreaId] = useState('');
  const [bayId, setBayId] = useState('');

  const { data: areasData } = useQuery('holding-areas', () =>
    containersApi.holdingAreas().then(r => r.data)
  );

  const mutation = useMutation(
    (data) => containersApi.assignBay(transaction.id, data),
    {
      onSuccess: (res) => {
        toast.success('Bay assigned! Chit ready to print.');
        onSuccess(res.data);
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Bay assignment failed.'),
    }
  );

  return (
    <div className="card p-6 border-blue-200 bg-blue-50/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
        <div>
          <h2 className="font-semibold text-gray-900">Assign Bay</h2>
          <p className="text-xs text-gray-500">
            <span className="font-mono font-semibold">{transaction.container_number}</span>
            {transaction.waybill_number && <> · WB: {transaction.waybill_number}</>}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">Holding Area <span className="text-gray-400">(auto-assign if blank)</span></label>
          <select className="input" value={holdingAreaId} onChange={e => setHoldingAreaId(e.target.value)}>
            <option value="">— Auto assign —</option>
            {(areasData || []).map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.occupied}/{a.total_bays} occupied)</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate({ holdingAreaId: holdingAreaId || undefined, bayId: bayId || undefined })}
            disabled={mutation.isLoading}
            className="btn-primary flex-1 justify-center py-2.5"
          >
            {mutation.isLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><MapPin size={16} /> Assign Bay & Generate Chit</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Allocate (one-step) ────────────────────────────────────────────────
function QuickAllocateForm() {
  const [form, setForm] = useState({
    waybillNumber: '', containerNumber: '', agentName: '', agentPhone: '', truckNumber: '', holdingAreaId: '',
  });
  const [cnError, setCnError] = useState('');
  const [chit, setChit] = useState(null);

  const { data: areasData } = useQuery('holding-areas', () =>
    containersApi.holdingAreas().then(r => r.data)
  );

  const mutation = useMutation(containersApi.allocate, {
    onSuccess: (res) => {
      toast.success('Allocation created! Chit ready to print.');
      setChit(res.data);
      setForm({ waybillNumber: '', containerNumber: '', agentName: '', agentPhone: '', truckNumber: '', holdingAreaId: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create allocation.'),
  });

  const validateCN = (val) => {
    const upper = val.toUpperCase();
    if (!upper) { setCnError(''); return upper; }
    setCnError(CONTAINER_REGEX.test(upper) ? '' : 'Format: 4 uppercase letters + 7 digits (e.g. HLBU2304692)');
    return upper;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!CONTAINER_REGEX.test(form.containerNumber)) return toast.error('Invalid container number format.');
    mutation.mutate(form);
  };

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Ticket size={18} className="text-blue-600" />
          <div>
            <h2 className="font-semibold text-gray-900">Quick Allocate</h2>
            <p className="text-xs text-gray-500">Register and assign bay in one step</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Waybill Number</label>
              <input className="input font-mono uppercase" placeholder="WB-20260408-001"
                value={form.waybillNumber} onChange={e => setForm(f => ({ ...f, waybillNumber: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label">Container Number *</label>
              <input className={clsx('input font-mono uppercase', cnError && 'border-red-400')}
                placeholder="HLBU2304692" value={form.containerNumber}
                onChange={e => setForm(f => ({ ...f, containerNumber: validateCN(e.target.value) }))}
                maxLength={11} required />
              {cnError && <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1"><AlertCircle size={10}/>{cnError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Agent Name *</label>
              <input className="input" placeholder="Full name" value={form.agentName}
                onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Agent Phone *</label>
              <input className="input" placeholder="+233 244 000 000" value={form.agentPhone}
                onChange={e => setForm(f => ({ ...f, agentPhone: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Truck Number</label>
              <input className="input uppercase" placeholder="GR-5678-21" value={form.truckNumber}
                onChange={e => setForm(f => ({ ...f, truckNumber: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label">Holding Area</label>
              <select className="input" value={form.holdingAreaId}
                onChange={e => setForm(f => ({ ...f, holdingAreaId: e.target.value }))}>
                <option value="">— Auto assign —</option>
                {(areasData || []).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.occupied}/{a.total_bays})</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={mutation.isLoading || !!cnError} className="btn-primary w-full justify-center py-2.5">
            {mutation.isLoading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Ticket size={16} /> Allocate Bay & Generate Chit</>
            }
          </button>
        </form>
      </div>

      {chit && <ChitPrintView transaction={chit} onClose={() => setChit(null)} />}
    </>
  );
}

// ─── Recent Allocations ───────────────────────────────────────────────────────
function RecentAllocations() {
  const { data } = useQuery('recent-booth-txns', () =>
    containersApi.list({ limit: 8, status: 'BAY_ASSIGNED,ARRIVED_AT_BOOTH,PENDING_BAY_ASSIGNMENT' }).then(r => r.data),
    { refetchInterval: 30000 }
  );

  if (!data?.transactions?.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">Recent Allocations</p>
      </div>
      <div className="divide-y divide-gray-50">
        {data.transactions.map(t => (
          <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-sm text-gray-900 truncate">{t.container_number}</p>
              {t.waybill_number && <p className="text-xs text-gray-400">WB: {t.waybill_number}</p>}
              <p className="text-xs text-gray-500 truncate">{t.agent_name} · {t.bay_code || 'No bay'}</p>
            </div>
            <div className="text-right shrink-0">
              <StatusBadge status={t.status} />
              <p className="text-xs text-gray-400 mt-1">{format(new Date(t.created_at), 'HH:mm')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BoothPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState('quick');       // 'quick' | 'steps'
  const [step, setStep] = useState(1);             // 1 = check-in, 2 = assign bay
  const [checkedInTxn, setCheckedInTxn] = useState(null);
  const [chit, setChit] = useState(null);

  const handleCheckedIn = (txn) => {
    setCheckedInTxn(txn);
    setStep(2);
  };

  const handleBayAssigned = (txn) => {
    setChit(txn);
    setCheckedInTxn(null);
    setStep(1);
    qc.invalidateQueries('recent-booth-txns');
    qc.invalidateQueries('holding-areas');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket size={20} className="text-blue-600" /> Booth – Bay Allocation
        </h1>
        <p className="text-sm text-gray-500 mt-1">Register agents, assign bays, and issue digital chits.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white w-fit">
        <button onClick={() => { setMode('quick'); setStep(1); setCheckedInTxn(null); }}
          className={clsx('px-4 py-2 text-sm font-medium transition-colors',
            mode === 'quick' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
          Quick (1 step)
        </button>
        <button onClick={() => { setMode('steps'); setStep(1); setCheckedInTxn(null); }}
          className={clsx('px-4 py-2 text-sm font-medium transition-colors',
            mode === 'steps' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
          Step-by-step (2 steps)
        </button>
      </div>

      {mode === 'quick' ? (
        <QuickAllocateForm />
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={clsx('flex items-center gap-1.5 font-medium', step === 1 ? 'text-blue-600' : 'text-green-600')}>
              {step > 1 ? <CheckCircle size={14} /> : <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>}
              Check-In
            </div>
            <ArrowRight size={14} className="text-gray-400" />
            <div className={clsx('flex items-center gap-1.5 font-medium', step === 2 ? 'text-blue-600' : 'text-gray-400')}>
              <span className={clsx('w-5 h-5 rounded-full text-xs flex items-center justify-center',
                step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500')}>2</span>
              Assign Bay
            </div>
          </div>

          {step === 1 && <CheckInForm onSuccess={handleCheckedIn} />}

          {step === 2 && checkedInTxn && (
            <BayAssignForm
              transaction={checkedInTxn}
              onSuccess={handleBayAssigned}
              onCancel={() => { setStep(1); setCheckedInTxn(null); }}
            />
          )}
        </>
      )}

      <RecentAllocations />

      {chit && <ChitPrintView transaction={chit} onClose={() => setChit(null)} />}
    </div>
  );
}
