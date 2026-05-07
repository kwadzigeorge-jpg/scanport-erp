import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { stockApi, partsApi } from '../services/api';
import {
  PackagePlus, PackageMinus, ArrowLeftRight, SlidersHorizontal,
  ClipboardList, AlertTriangle, Search, ChevronLeft, ChevronRight,
  X, TrendingDown, Package, DollarSign, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Shared UI ────────────────────────────────────────────────────────────────
const CRITICALITY_BADGE = {
  NON_CRITICAL: 'bg-gray-100 text-gray-600',
  IMPORTANT:    'bg-yellow-100 text-yellow-700',
  CRITICAL:     'bg-red-100 text-red-700',
};

const STOCK_STATUS_BADGE = {
  OK:        'bg-green-100 text-green-700',
  LOW_STOCK: 'bg-yellow-100 text-yellow-700',
  STOCKOUT:  'bg-red-100 text-red-700',
  EXCESS:    'bg-blue-100 text-blue-700',
};

const TXN_TYPE_BADGE = {
  STOCK_IN:   'bg-green-100 text-green-700',
  STOCK_OUT:  'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-purple-100 text-purple-700',
  TRANSFER_IN:'bg-blue-100 text-blue-700',
  TRANSFER_OUT:'bg-orange-100 text-orange-700',
  RETURN:     'bg-teal-100 text-teal-700',
};

function Badge({ map, value }) {
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', map[value] || 'bg-gray-100 text-gray-500')}>
      {value?.replace(/_/g, ' ') || '—'}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={clsx('p-2 rounded-lg', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={clsx('bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col', wide ? 'max-w-xl' : 'max-w-md')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';

function PartInfo({ part }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
      <p className="font-mono text-xs text-gray-500">{part.part_number}</p>
      <p className="font-medium text-gray-900 text-sm">{part.description}</p>
      <div className="flex gap-3 mt-1 text-xs text-gray-500">
        <span>On Hand: <strong>{part.qty_on_hand}</strong></span>
        <span>Available: <strong className={parseFloat(part.qty_available) <= 0 ? 'text-red-600' : 'text-green-600'}>{part.qty_available}</strong></span>
        <span>{part.unit_of_measure}</span>
      </div>
    </div>
  );
}

// ─── Stock-In Modal ───────────────────────────────────────────────────────────
function StockInModal({ part, locations, onClose, onSuccess }) {
  const [form, setForm] = useState({ location_id: '', qty: '', unit_cost: part.unit_cost || '', notes: '' });
  const mut = useMutation(
    (d) => stockApi.stockIn(d),
    { onSuccess: () => { toast.success('Stock received.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.') }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.location_id) return toast.error('Select a location.'); if (!form.qty || parseFloat(form.qty) <= 0) return toast.error('Enter a valid qty.'); mut.mutate({ part_id: part.id, location_id: parseInt(form.location_id), qty: parseFloat(form.qty), unit_cost: parseFloat(form.unit_cost) || undefined, notes: form.notes || undefined }); }} className="space-y-4">
      <PartInfo part={part} />
      <Field label="Storage Location" required>
        <select className={sel} value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} required>
          <option value="">— Select location —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.warehouse}{l.shelf ? ` / ${l.shelf}` : ''}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" required>
          <input className={inp} type="number" min="0.001" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} required autoFocus />
        </Field>
        <Field label="Unit Cost (GHS)">
          <input className={inp} type="number" min="0" step="0.0001" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="PO reference, delivery note…" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Saving…' : 'Receive Stock'}
        </button>
      </div>
    </form>
  );
}

// ─── Stock-Out Modal ──────────────────────────────────────────────────────────
function StockOutModal({ part, onClose, onSuccess }) {
  const [form, setForm] = useState({ location_id: '', qty: '', purpose: '', notes: '' });
  const { data: partStock } = useQuery(['partStock', part.id], () => stockApi.partStock(part.id).then(r => r.data));
  const stockedLocations = (partStock || []).filter(s => parseFloat(s.qty_on_hand) > 0);

  const mut = useMutation(
    (d) => stockApi.stockOut(d),
    { onSuccess: () => { toast.success('Stock issued.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.') }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.location_id) return toast.error('Select a location.'); if (!form.qty || parseFloat(form.qty) <= 0) return toast.error('Enter a valid qty.'); mut.mutate({ part_id: part.id, location_id: parseInt(form.location_id), qty: parseFloat(form.qty), purpose: form.purpose || undefined, notes: form.notes || undefined }); }} className="space-y-4">
      <PartInfo part={part} />
      <Field label="Issue From" required>
        <select className={sel} value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} required>
          <option value="">— Select location —</option>
          {stockedLocations.map(s => <option key={s.location_id} value={s.location_id}>{s.location_code} — Available: {parseFloat(s.qty_available)}</option>)}
        </select>
      </Field>
      <Field label="Quantity" required>
        <input className={inp} type="number" min="0.001" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} required autoFocus />
      </Field>
      <Field label="Purpose">
        <input className={inp} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. Maintenance WO-1234" />
      </Field>
      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Saving…' : 'Issue Stock'}
        </button>
      </div>
    </form>
  );
}

// ─── Adjust Modal ─────────────────────────────────────────────────────────────
function AdjustModal({ part, onClose, onSuccess }) {
  const [form, setForm] = useState({ location_id: '', new_qty: '', reason: '', notes: '' });
  const { data: partStock } = useQuery(['partStock', part.id], () => stockApi.partStock(part.id).then(r => r.data));
  const selectedLoc = (partStock || []).find(s => s.location_id === parseInt(form.location_id));

  const mut = useMutation(
    (d) => stockApi.adjust(d),
    { onSuccess: () => { toast.success('Stock adjusted.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.') }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.location_id) return toast.error('Select a location.'); if (form.new_qty === '') return toast.error('Enter new qty.'); if (!form.reason?.trim()) return toast.error('Reason is required.'); mut.mutate({ part_id: part.id, location_id: parseInt(form.location_id), new_qty: parseFloat(form.new_qty), reason: form.reason, notes: form.notes || undefined }); }} className="space-y-4">
      <PartInfo part={part} />
      <Field label="Location" required>
        <select className={sel} value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} required>
          <option value="">— Select location —</option>
          {(partStock || []).map(s => <option key={s.location_id} value={s.location_id}>{s.location_code} — Current: {parseFloat(s.qty_on_hand)}</option>)}
        </select>
      </Field>
      {selectedLoc && (
        <div className="text-xs text-gray-500 -mt-2">Current count at this location: <strong>{parseFloat(selectedLoc.qty_on_hand)} {part.unit_of_measure}</strong></div>
      )}
      <Field label="Actual Count (new qty)" required>
        <input className={inp} type="number" min="0" step="any" value={form.new_qty} onChange={e => setForm(f => ({ ...f, new_qty: e.target.value }))} required autoFocus />
      </Field>
      <Field label="Reason" required>
        <select className={sel} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required>
          <option value="">— Select reason —</option>
          {['Cycle count','Damaged/written off','Found stock','Data correction','Other'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading} className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Saving…' : 'Apply Adjustment'}
        </button>
      </div>
    </form>
  );
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({ part, locations, onClose, onSuccess }) {
  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', qty: '', notes: '' });
  const { data: partStock } = useQuery(['partStock', part.id], () => stockApi.partStock(part.id).then(r => r.data));
  const stockedLocations = (partStock || []).filter(s => parseFloat(s.qty_on_hand) > 0);

  const mut = useMutation(
    (d) => stockApi.transfer(d),
    { onSuccess: () => { toast.success('Transfer complete.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.') }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.from_location_id || !form.to_location_id) return toast.error('Select both locations.'); if (form.from_location_id === form.to_location_id) return toast.error('From and To must differ.'); if (!form.qty || parseFloat(form.qty) <= 0) return toast.error('Enter a valid qty.'); mut.mutate({ part_id: part.id, from_location_id: parseInt(form.from_location_id), to_location_id: parseInt(form.to_location_id), qty: parseFloat(form.qty), notes: form.notes || undefined }); }} className="space-y-4">
      <PartInfo part={part} />
      <Field label="From Location" required>
        <select className={sel} value={form.from_location_id} onChange={e => setForm(f => ({ ...f, from_location_id: e.target.value }))} required>
          <option value="">— Select source —</option>
          {stockedLocations.map(s => <option key={s.location_id} value={s.location_id}>{s.location_code} — Avail: {parseFloat(s.qty_available)}</option>)}
        </select>
      </Field>
      <Field label="To Location" required>
        <select className={sel} value={form.to_location_id} onChange={e => setForm(f => ({ ...f, to_location_id: e.target.value }))} required>
          <option value="">— Select destination —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.warehouse}</option>)}
        </select>
      </Field>
      <Field label="Quantity" required>
        <input className={inp} type="number" min="0.001" step="any" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} required autoFocus />
      </Field>
      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Saving…' : 'Transfer'}
        </button>
      </div>
    </form>
  );
}

// ─── Ledger Modal ─────────────────────────────────────────────────────────────
function LedgerModal({ part, onClose }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    ['ledger', part.id, page],
    () => stockApi.ledger(part.id, { page, limit: 15 }).then(r => r.data),
    { keepPreviousData: true }
  );
  const ledger     = data?.ledger     || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 15));

  const fmt = (n) => parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="font-mono text-xs text-gray-500">{part.part_number}</p>
        <p className="font-medium text-gray-900 text-sm">{part.description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wide">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Type</th>
              <th className="py-2 text-left">Ref</th>
              <th className="py-2 text-left">Location</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">After</th>
              <th className="py-2 text-left">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : ledger.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No movements yet.</td></tr>
            ) : ledger.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="py-2 text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                <td className="py-2"><Badge map={TXN_TYPE_BADGE} value={l.txn_type} /></td>
                <td className="py-2 font-mono text-gray-500">{l.txn_ref}</td>
                <td className="py-2 text-gray-500">{l.location_code}</td>
                <td className={clsx('py-2 text-right font-medium', parseFloat(l.qty) < 0 ? 'text-red-600' : 'text-green-600')}>
                  {parseFloat(l.qty) > 0 ? '+' : ''}{fmt(l.qty)}
                </td>
                <td className="py-2 text-right text-gray-600">{fmt(l.qty_after)}</td>
                <td className="py-2 text-gray-500">{l.created_by_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
      </div>
    </div>
  );
}

// ─── Balances Tab ─────────────────────────────────────────────────────────────
function BalancesTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', criticality: '', stock_status: '', page: 1 });
  const [modal, setModal]     = useState(null); // { type, part }

  const { data, isLoading } = useQuery(
    ['balances', filters],
    () => stockApi.balances({ search: filters.search || undefined, criticality: filters.criticality || undefined, stock_status: filters.stock_status || undefined, page: filters.page, limit: 25 }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: locations } = useQuery('locations', () => partsApi.listLocations().then(r => r.data));

  const balances   = data?.balances || [];
  const summary    = data?.summary  || {};
  const totalPages = Math.max(1, Math.ceil((balances.length === 25 ? (filters.page * 25 + 1) : ((filters.page - 1) * 25 + balances.length)) / 25));

  const onMoved = () => qc.invalidateQueries('balances');

  const fmt = (n) => parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const closeModal = () => setModal(null);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Package}       label="Total Active Parts"   value={summary.total_parts ?? '—'}       color="bg-blue-500" />
        <SummaryCard icon={AlertCircle}   label="Stockouts"            value={summary.stockout_count ?? '—'}    color="bg-red-500" sub="need replenishment" />
        <SummaryCard icon={TrendingDown}  label="Low Stock"            value={summary.low_stock_count ?? '—'}   color="bg-yellow-500" sub="at or below reorder point" />
        <SummaryCard icon={DollarSign}    label="Inventory Value (GHS)"value={`GHS ${fmt(summary.total_inventory_value)}`} color="bg-green-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={clsx(inp, 'pl-8')} placeholder="Search part…"
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select className={clsx(sel, 'w-40')} value={filters.criticality} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value, page: 1 }))}>
          <option value="">All Criticality</option>
          {['CRITICAL','IMPORTANT','NON_CRITICAL'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
        </select>
        <select className={clsx(sel, 'w-36')} value={filters.stock_status} onChange={e => setFilters(f => ({ ...f, stock_status: e.target.value, page: 1 }))}>
          <option value="">All Status</option>
          {['STOCKOUT','LOW_STOCK','OK','EXCESS'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Part</th>
                <th className="px-4 py-3 text-left">Criticality</th>
                <th className="px-4 py-3 text-right">On Hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">WAVG Cost</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={9} className="py-16 text-center text-gray-400">Loading…</td></tr>
              ) : balances.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-gray-400">No parts found.</td></tr>
              ) : balances.map(p => {
                const stockStatus = parseFloat(p.qty_on_hand) === 0 ? 'STOCKOUT'
                  : parseFloat(p.qty_available) <= parseFloat(p.reorder_point) ? 'LOW_STOCK' : 'OK';
                return (
                  <tr key={p.id} className={clsx('hover:bg-gray-50 transition-colors', p.has_alert && 'bg-red-50/30')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.has_alert && <AlertTriangle size={13} className="text-orange-400 shrink-0" />}
                        <div>
                          <p className="font-mono text-xs text-gray-500">{p.part_number}</p>
                          <p className="font-medium text-gray-900 text-xs">{p.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge map={CRITICALITY_BADGE} value={p.criticality} /></td>
                    <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">{parseFloat(p.qty_on_hand).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{parseFloat(p.qty_reserved).toFixed(2)}</td>
                    <td className={clsx('px-4 py-3 text-right font-mono text-xs font-medium', parseFloat(p.qty_available) <= 0 ? 'text-red-600' : 'text-green-700')}>
                      {parseFloat(p.qty_available).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{fmt(p.weighted_avg_cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 text-xs">{fmt(p.total_value)}</td>
                    <td className="px-4 py-3"><Badge map={STOCK_STATUS_BADGE} value={stockStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {hasPermission('stock.receive') && (
                          <button onClick={() => setModal({ type: 'in', part: p })} title="Stock In" className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"><PackagePlus size={14} /></button>
                        )}
                        {hasPermission('stock.issue') && (
                          <button onClick={() => setModal({ type: 'out', part: p })} title="Stock Out" className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"><PackageMinus size={14} /></button>
                        )}
                        {hasPermission('stock.transfer') && (
                          <button onClick={() => setModal({ type: 'transfer', part: p })} title="Transfer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"><ArrowLeftRight size={14} /></button>
                        )}
                        {hasPermission('stock.adjust') && (
                          <button onClick={() => setModal({ type: 'adjust', part: p })} title="Adjust" className="p-1.5 text-purple-500 hover:bg-purple-50 rounded transition-colors"><SlidersHorizontal size={14} /></button>
                        )}
                        <button onClick={() => setModal({ type: 'ledger', part: p })} title="View Ledger" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"><ClipboardList size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>Page {filters.page}</span>
          <div className="flex gap-1">
            <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button disabled={balances.length < 25} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'in' && <Modal title="Receive Stock" onClose={closeModal}><StockInModal part={modal.part} locations={locations || []} onClose={closeModal} onSuccess={onMoved} /></Modal>}
      {modal?.type === 'out' && <Modal title="Issue Stock" onClose={closeModal}><StockOutModal part={modal.part} onClose={closeModal} onSuccess={onMoved} /></Modal>}
      {modal?.type === 'adjust' && <Modal title="Adjust Stock" onClose={closeModal}><AdjustModal part={modal.part} onClose={closeModal} onSuccess={onMoved} /></Modal>}
      {modal?.type === 'transfer' && <Modal title="Transfer Stock" onClose={closeModal}><TransferModal part={modal.part} locations={locations || []} onClose={closeModal} onSuccess={onMoved} /></Modal>}
      {modal?.type === 'ledger' && <Modal title="Movement Ledger" onClose={closeModal} wide><LedgerModal part={modal.part} onClose={closeModal} /></Modal>}
    </div>
  );
}

// ─── Reorder Tab ──────────────────────────────────────────────────────────────
function ReorderTab() {
  const { data, isLoading } = useQuery('reorderList', () => stockApi.reorderList().then(r => r.data));
  const items = Array.isArray(data) ? data : (data?.parts || []);
  const fmt = (n) => parseFloat(n || 0).toFixed(2);

  return (
    <div className="space-y-4">
      {!isLoading && items.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-medium">All parts are above reorder point.</p>
          <p className="text-green-600 text-sm mt-1">No action required at this time.</p>
        </div>
      )}
      {(items.length > 0 || isLoading) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <span className="font-medium text-sm text-gray-900">Parts Requiring Replenishment</span>
            {!isLoading && <span className="ml-auto text-xs text-gray-400">{items.length} parts</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Part</th>
                  <th className="px-4 py-3 text-left">Criticality</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Reorder Pt.</th>
                  <th className="px-4 py-3 text-right">Reorder Qty</th>
                  <th className="px-4 py-3 text-right">Lead Time</th>
                  <th className="px-4 py-3 text-right">Avg Daily Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading…</td></tr>
                ) : items.map(p => (
                  <tr key={p.id} className={clsx('hover:bg-gray-50', parseFloat(p.qty_available) <= 0 && 'bg-red-50/30')}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-500">{p.part_number}</p>
                      <p className="font-medium text-gray-900 text-xs">{p.description}</p>
                    </td>
                    <td className="px-4 py-3"><Badge map={CRITICALITY_BADGE} value={p.criticality} /></td>
                    <td className={clsx('px-4 py-3 text-right font-medium text-xs', parseFloat(p.qty_available) <= 0 ? 'text-red-600' : 'text-yellow-600')}>
                      {fmt(p.qty_available)} {p.unit_of_measure}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{fmt(p.reorder_point)}</td>
                    <td className="px-4 py-3 text-right text-xs text-blue-600 font-medium">{fmt(p.reorder_qty)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{p.lead_time_days ?? '—'} days</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{p.avg_daily_consumption ? fmt(p.avg_daily_consumption) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'balances', label: 'Stock Balances', icon: Package },
  { id: 'reorder',  label: 'Reorder List',   icon: AlertTriangle },
];

export default function StockPage() {
  const [tab, setTab] = useState('balances');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stock Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">View stock levels and record movements — receive, issue, adjust, transfer.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'balances' && <BalancesTab />}
      {tab === 'reorder'  && <ReorderTab />}
    </div>
  );
}
