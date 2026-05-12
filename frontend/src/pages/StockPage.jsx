import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { stockApi, partsApi } from '../services/api';
import {
  PackagePlus, PackageMinus, ArrowLeftRight, SlidersHorizontal,
  ClipboardList, AlertTriangle, Search, ChevronLeft, ChevronRight,
  X, TrendingDown, Package, DollarSign, AlertCircle, CheckCircle, Bell,
  FileBarChart2, Download, Printer, ChevronDown, ChevronUp, Filter,
  UserCheck, RotateCcw, Clock, CheckCircle2, CircleDot,
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

// ─── Alerts Tab ──────────────────────────────────────────────────────────────
const ALERT_TYPE_BADGE = {
  LOW_STOCK:    'bg-yellow-100 text-yellow-700',
  STOCKOUT:     'bg-red-100 text-red-700',
  EXCESS_STOCK: 'bg-blue-100 text-blue-700',
};

const SEVERITY_BADGE = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MEDIUM:   'bg-yellow-100 text-yellow-700',
  LOW:      'bg-gray-100 text-gray-500',
};

function AlertsTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ alert_type: '', severity: '', is_resolved: 'false' });

  const { data: alerts, isLoading } = useQuery(
    ['alerts', filters],
    () => stockApi.alerts({ alert_type: filters.alert_type || undefined, severity: filters.severity || undefined, is_resolved: filters.is_resolved }).then(r => r.data),
    { refetchInterval: 60000 }
  );

  const resolveMut = useMutation(
    (id) => stockApi.resolveAlert(id),
    {
      onSuccess: () => { toast.success('Alert resolved.'); qc.invalidateQueries('alerts'); qc.invalidateQueries('balances'); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const items = Array.isArray(alerts) ? alerts : [];

  const counts = {
    STOCKOUT:     items.filter(a => a.alert_type === 'STOCKOUT').length,
    LOW_STOCK:    items.filter(a => a.alert_type === 'LOW_STOCK').length,
    EXCESS_STOCK: items.filter(a => a.alert_type === 'EXCESS_STOCK').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      {filters.is_resolved === 'false' && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-sm font-medium text-red-700">{counts.STOCKOUT} Stockout{counts.STOCKOUT !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <TrendingDown size={14} className="text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">{counts.LOW_STOCK} Low Stock</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Package size={14} className="text-blue-500" />
            <span className="text-sm font-medium text-blue-700">{counts.EXCESS_STOCK} Excess</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select className={clsx(sel, 'w-40')} value={filters.alert_type} onChange={e => setFilters(f => ({ ...f, alert_type: e.target.value }))}>
          <option value="">All Types</option>
          <option value="STOCKOUT">Stockout</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="EXCESS_STOCK">Excess Stock</option>
        </select>
        <select className={clsx(sel, 'w-36')} value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All Severity</option>
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="ml-auto flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setFilters(f => ({ ...f, is_resolved: 'false' }))}
            className={clsx('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', filters.is_resolved === 'false' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Active
          </button>
          <button onClick={() => setFilters(f => ({ ...f, is_resolved: 'true' }))}
            className={clsx('px-3 py-1.5 text-xs font-medium rounded-md transition-colors', filters.is_resolved === 'true' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Resolved
          </button>
        </div>
      </div>

      {/* Alerts table */}
      {!isLoading && items.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">{filters.is_resolved === 'true' ? 'No resolved alerts.' : 'No active alerts — stock levels are healthy.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Part</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-right">Current Qty</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-right">Lead Time</th>
                  <th className="px-4 py-3 text-left">Raised</th>
                  {filters.is_resolved === 'false' && hasPermission('stock.adjust') && (
                    <th className="px-4 py-3 text-right">Action</th>
                  )}
                  {filters.is_resolved === 'true' && (
                    <th className="px-4 py-3 text-left">Resolved</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={9} className="py-16 text-center text-gray-400">Loading…</td></tr>
                ) : items.map(a => (
                  <tr key={a.id} className={clsx('hover:bg-gray-50 transition-colors', a.severity === 'CRITICAL' && !a.is_resolved && 'bg-red-50/20')}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-500">{a.part_number}</p>
                      <p className="font-medium text-gray-900 text-xs">{a.description}</p>
                      <p className="text-xs text-gray-400">{a.unit_of_measure}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', ALERT_TYPE_BADGE[a.alert_type] || 'bg-gray-100 text-gray-500')}>
                        {a.alert_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', SEVERITY_BADGE[a.severity] || 'bg-gray-100 text-gray-500')}>
                        {a.severity}
                      </span>
                    </td>
                    <td className={clsx('px-4 py-3 text-right text-xs font-medium', parseFloat(a.current_qty_on_hand) <= 0 ? 'text-red-600' : 'text-yellow-600')}>
                      {parseFloat(a.current_qty_on_hand).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{parseFloat(a.threshold_qty || a.reorder_point || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700">{a.supplier_name || '—'}</p>
                      {a.supplier_phone && <p className="text-xs text-gray-400">{a.supplier_phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{a.lead_time_days ?? '—'} days</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                    {filters.is_resolved === 'false' && hasPermission('stock.adjust') && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { if (confirm('Mark this alert as resolved?')) resolveMut.mutate(a.id); }}
                          disabled={resolveMut.isLoading}
                          className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 border border-green-200 px-2 py-1 rounded-lg transition-colors ml-auto disabled:opacity-50"
                        >
                          <CheckCircle size={12} /> Resolve
                        </button>
                      </td>
                    )}
                    {filters.is_resolved === 'true' && (
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {a.resolved_at ? new Date(a.resolved_at).toLocaleDateString() : '—'}
                      </td>
                    )}
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

// ─── Monthly Stock Movement Report ───────────────────────────────────────────
function fmt(n, dec = 0) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getMonthBounds(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last  = new Date(year, month, 0).getDate();
  const to    = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function StatusDot({ status }) {
  const colors = { OK: 'bg-green-500', LOW: 'bg-yellow-500', STOCKOUT: 'bg-red-500' };
  const labels = { OK: 'OK', LOW: 'Low', STOCKOUT: 'Out' };
  return (
    <span className="flex items-center gap-1">
      <span className={clsx('inline-block w-2 h-2 rounded-full', colors[status] || 'bg-gray-300')} />
      <span className="text-xs text-gray-500">{labels[status] || status}</span>
    </span>
  );
}

function MovementReportTab() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [categoryId, setCategoryId] = useState('');
  const [movementOnly, setMovementOnly] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const { from, to } = getMonthBounds(year, month);

  const { data, isLoading, isFetching, error } = useQuery(
    ['movement-report', from, to, categoryId],
    () => stockApi.movementReport({ from, to, category_id: categoryId || undefined }).then(r => r.data),
    { keepPreviousData: true, retry: 1 }
  );

  const { data: cats = [] } = useQuery('part-categories', () => partsApi.listCategories().then(r => r.data));

  const parts   = data ? (movementOnly ? data.parts.filter(p => p.has_movement) : data.parts) : [];
  const summary = data?.summary || {};

  // Group by category
  const grouped = parts.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  const navMonth = (delta) => {
    let m = month + delta, y = year;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const exportCSV = () => {
    const header = ['No','Part Number','Description','Category','Criticality','UOM',
                    'Opening Qty','Stock In','Stock Out','Adjustments','Closing Qty',
                    'Unit Cost (GHS)','Closing Value (GHS)','Status'];
    const rows = parts.map((p, i) => [
      i + 1, p.part_number, `"${p.description.replace(/"/g, '""')}"`,
      p.category, p.criticality, p.unit_of_measure,
      p.opening_qty, p.stock_in, p.stock_out, p.adjustments, p.closing_qty,
      p.unit_cost.toFixed(4), p.closing_value.toFixed(2), p.stock_status,
    ]);
    const totalRow = ['TOTAL','','','','','',
      fmt(summary.total_opening_qty), fmt(summary.total_stock_in),
      fmt(summary.total_stock_out), '', fmt(summary.total_closing_qty),
      '', fmt(summary.total_closing_value, 2), ''];
    const csv = [header, ...rows, totalRow].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `stock-movement-${MONTH_NAMES[month - 1]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const style = document.createElement('style');
    style.id = '_print_override';
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #stock-movement-report { display: block !important; position: static !important; }
        #stock-movement-report .no-print { display: none !important; }
        @page { margin: 1cm; size: A4 landscape; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { const el = document.getElementById('_print_override'); if (el) el.remove(); }, 1500);
  };

  const COL_W = 'text-right';

  const CategorySubtotal = ({ rows }) => {
    const si  = rows.reduce((s, r) => s + r.stock_in, 0);
    const so  = rows.reduce((s, r) => s + r.stock_out, 0);
    const adj = rows.reduce((s, r) => s + r.adjustments, 0);
    const cl  = rows.reduce((s, r) => s + r.closing_qty, 0);
    const val = rows.reduce((s, r) => s + r.closing_value, 0);
    return (
      <tr className="bg-gray-50 text-xs font-semibold text-gray-600 border-t border-gray-300">
        <td colSpan={6} className="px-3 py-1.5 text-right italic">Sub-total</td>
        <td className={clsx('px-3 py-1.5', COL_W)}></td>
        <td className={clsx('px-3 py-1.5 text-green-700', COL_W)}>{si > 0 ? fmt(si) : '—'}</td>
        <td className={clsx('px-3 py-1.5 text-red-700', COL_W)}>{so > 0 ? fmt(so) : '—'}</td>
        <td className={clsx('px-3 py-1.5', COL_W)}>{adj !== 0 ? fmt(adj) : '—'}</td>
        <td className={clsx('px-3 py-1.5', COL_W)}>{fmt(cl)}</td>
        <td className={clsx('px-3 py-1.5', COL_W)}>{val > 0 ? `GHS ${fmt(val, 2)}` : '—'}</td>
        <td />
      </tr>
    );
  };

  return (
    <div id="stock-movement-report">
      {/* ── Controls ── */}
      <div className="no-print flex flex-wrap items-center gap-3 mb-4">
        {/* Period nav */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button onClick={() => navMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium px-2 min-w-[130px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={() => navMonth(1)} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Category filter */}
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">All Categories</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Movement only toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <div onClick={() => setMovementOnly(v => !v)}
            className={clsx('w-8 h-4 rounded-full transition-colors relative',
              movementOnly ? 'bg-blue-600' : 'bg-gray-300')}>
            <span className={clsx('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform',
              movementOnly ? 'left-4' : 'left-0.5')} />
          </div>
          With movement only
        </label>

        <div className="flex-1" />

        {/* Actions */}
        {isFetching && <span className="text-xs text-gray-400">Refreshing…</span>}
        <button onClick={exportCSV} disabled={!data || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Download size={14} /> Export CSV
        </button>
        <button onClick={printReport} disabled={!data || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* ── Print header (hidden on screen) ── */}
      <div className="hidden print:block mb-4">
        <p className="text-lg font-bold">SCANPORT LTD — MPS Port, Scanport Store</p>
        <p className="text-sm font-semibold">Stock Movement / Position Report</p>
        <p className="text-xs text-gray-600">Period: {MONTH_NAMES[month - 1]} {year} &nbsp;|&nbsp; Generated: {new Date().toLocaleString()}</p>
      </div>

      {/* ── Summary cards ── */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <SummaryCard icon={Package}      label="Total Parts"    value={fmt(summary.total_parts)} color="bg-blue-600" />
          <SummaryCard icon={PackagePlus}  label="Total Stock In" value={fmt(summary.total_stock_in)} color="bg-green-600" />
          <SummaryCard icon={PackageMinus} label="Total Stock Out" value={fmt(summary.total_stock_out)} color="bg-red-500" />
          <SummaryCard icon={DollarSign}   label="Closing Value"
            value={`GHS ${fmt(summary.total_closing_value, 2)}`}
            sub={`${fmt(summary.parts_with_movement)} parts moved`} color="bg-purple-600" />
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : error ? (
        <div className="text-center py-20 text-red-500 text-sm">
          Failed to load report: {error.response?.data?.error || error.message}
        </div>
      ) : parts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No parts found for this period.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto text-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left w-8">#</th>
                <th className="px-3 py-2.5 text-left">Part Number</th>
                <th className="px-3 py-2.5 text-left">Description</th>
                <th className="px-3 py-2.5 text-left">Criticality</th>
                <th className="px-3 py-2.5 text-left">UOM</th>
                <th className="px-3 py-2.5 text-left">ROP</th>
                <th className="px-3 py-2.5 text-right">Opening</th>
                <th className="px-3 py-2.5 text-right text-green-700">Stock In</th>
                <th className="px-3 py-2.5 text-right text-red-700">Stock Out</th>
                <th className="px-3 py-2.5 text-right">Adj</th>
                <th className="px-3 py-2.5 text-right font-bold">Closing</th>
                <th className="px-3 py-2.5 text-right">Value (GHS)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([cat, catRows]) => {
                const isOpen = !collapsed[cat];
                return (
                  <React.Fragment key={cat}>
                    {/* Category header */}
                    <tr className="bg-blue-50 border-t border-gray-200 cursor-pointer no-print"
                      onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}>
                      <td colSpan={13} className="px-3 py-2 font-semibold text-blue-800 text-xs">
                        <span className="flex items-center gap-1.5">
                          {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                          {cat} <span className="font-normal text-blue-500">({catRows.length} part{catRows.length !== 1 ? 's' : ''})</span>
                        </span>
                      </td>
                    </tr>
                    {/* Print-only static category header */}
                    <tr className="hidden print:table-row bg-blue-50 border-t border-gray-200">
                      <td colSpan={13} className="px-3 py-1.5 font-semibold text-blue-800 text-xs">{cat}</td>
                    </tr>

                    {isOpen && catRows.map(p => (
                      <tr key={p.id} className={clsx(
                        'border-t border-gray-100 hover:bg-gray-50',
                        p.stock_status === 'STOCKOUT' && 'bg-red-50/40',
                        p.stock_status === 'LOW' && 'bg-yellow-50/40',
                      )}>
                        <td className="px-3 py-2 text-gray-400">{p.row_no}</td>
                        <td className="px-3 py-2 font-mono font-medium text-gray-800 whitespace-nowrap">{p.part_number}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={p.description}>{p.description}</td>
                        <td className="px-3 py-2">
                          <Badge map={CRITICALITY_BADGE} value={p.criticality} />
                        </td>
                        <td className="px-3 py-2 text-gray-500">{p.unit_of_measure}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{p.reorder_point > 0 ? fmt(p.reorder_point) : '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(p.opening_qty)}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{p.stock_in > 0 ? fmt(p.stock_in) : '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-700">{p.stock_out > 0 ? fmt(p.stock_out) : '—'}</td>
                        <td className={clsx('px-3 py-2 text-right', p.adjustments > 0 ? 'text-green-600' : p.adjustments < 0 ? 'text-red-600' : 'text-gray-400')}>
                          {p.adjustments !== 0 ? (p.adjustments > 0 ? '+' : '') + fmt(p.adjustments) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">{fmt(p.closing_qty)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {p.closing_value > 0 ? fmt(p.closing_value, 2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center"><StatusDot status={p.stock_status} /></td>
                      </tr>
                    ))}
                    {isOpen && <CategorySubtotal rows={catRows} />}
                  </React.Fragment>
                );
              })}

              {/* Grand total */}
              <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold text-gray-900 text-xs">
                <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wide">Grand Total</td>
                <td className="px-3 py-2.5 text-right">{fmt(summary.total_opening_qty)}</td>
                <td className="px-3 py-2.5 text-right text-green-700">{fmt(summary.total_stock_in)}</td>
                <td className="px-3 py-2.5 text-right text-red-700">{fmt(summary.total_stock_out)}</td>
                <td className="px-3 py-2.5 text-right">—</td>
                <td className="px-3 py-2.5 text-right">{fmt(summary.total_closing_qty)}</td>
                <td className="px-3 py-2.5 text-right">GHS {fmt(summary.total_closing_value, 2)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2 no-print">
        Report period: {from} to {to} &nbsp;·&nbsp; {parts.length} part{parts.length !== 1 ? 's' : ''} shown
      </p>
    </div>
  );
}

// ─── Parts Issued Tab ─────────────────────────────────────────────────────────
const ISSUE_STATUS = {
  issued:   { label: 'Issued',   bg: 'bg-blue-100',  text: 'text-blue-700',  Icon: CircleDot    },
  returned: { label: 'Returned', bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  lost:     { label: 'Lost',     bg: 'bg-gray-100',  text: 'text-gray-500',  Icon: X            },
};

function IssueStatusBadge({ status }) {
  const cfg = ISSUE_STATUS[status] || ISSUE_STATUS.issued;
  const { Icon, bg, text, label } = cfg;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', bg, text)}>
      <Icon size={10} /> {label}
    </span>
  );
}

function IssuePartModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    part_id: '', location_id: '', qty: '1', personnel_id: '',
    work_order: '', purpose: '',
  });
  const [partSearch, setPartSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: balancesData } = useQuery(
    ['balances-issue', partSearch],
    () => stockApi.balances({ search: partSearch || undefined, page: 1, limit: 30 }).then(r => r.data),
    { enabled: partSearch.length > 1, keepPreviousData: true }
  );
  const parts = balancesData?.balances || [];
  const selectedPart = parts.find(p => String(p.id) === String(form.part_id));

  const { data: partStockData } = useQuery(
    ['partStock-issue', form.part_id],
    () => stockApi.partStock(form.part_id).then(r => r.data),
    { enabled: !!form.part_id }
  );
  const stockedLocations = (partStockData || []).filter(s => parseFloat(s.qty_on_hand) > 0);

  const { data: personnel = [] } = useQuery('storePersonnel', stockApi.personnel);
  const activePersonnel = personnel.filter(p => p.is_active);

  const mut = useMutation(
    (d) => stockApi.createCheckout(d),
    {
      onSuccess: () => { toast.success('Part issued and recorded.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed to issue part.'),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.part_id)     return toast.error('Select a part.');
    if (!form.location_id) return toast.error('Select a location.');
    if (!form.personnel_id) return toast.error('Select a person.');
    if (!form.qty || parseFloat(form.qty) <= 0) return toast.error('Enter a valid qty.');
    mut.mutate({
      part_id:      parseInt(form.part_id),
      location_id:  parseInt(form.location_id),
      qty:          parseFloat(form.qty),
      personnel_id: parseInt(form.personnel_id),
      work_order:   form.work_order || undefined,
      purpose:      form.purpose   || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Part search */}
      <Field label="Part" required>
        <div className="space-y-1.5">
          <input
            className={inp} placeholder="Type part number or description to search…"
            value={partSearch}
            onChange={e => {
              setPartSearch(e.target.value);
              set('part_id', '');
              set('location_id', '');
              setShowDropdown(true);
            }}
          />
          {showDropdown && parts.length > 0 && !form.part_id && (
            <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-50 shadow-sm">
              {parts.map(p => (
                <button key={p.id} type="button"
                  onClick={() => {
                    set('part_id', String(p.id));
                    setPartSearch(`${p.part_number} — ${p.description}`);
                    set('location_id', '');
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors">
                  <p className="font-mono text-xs text-gray-500">{p.part_number}</p>
                  <p className="text-xs text-gray-800 font-medium">{p.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Available: {parseFloat(p.qty_available).toFixed(2)} {p.unit_of_measure}</p>
                </button>
              ))}
            </div>
          )}
          {form.part_id && selectedPart && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Package size={13} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800 truncate">{selectedPart.description}</p>
                <p className="text-xs text-blue-500">Available: {parseFloat(selectedPart.qty_available).toFixed(2)} {selectedPart.unit_of_measure}</p>
              </div>
              <button type="button" onClick={() => { set('part_id', ''); set('location_id', ''); setPartSearch(''); setShowDropdown(false); }}
                className="text-blue-400 hover:text-blue-600 shrink-0"><X size={13} /></button>
            </div>
          )}
        </div>
      </Field>

      {/* Location */}
      {form.part_id && (
        <Field label="Issue From Location" required>
          <select className={sel} value={form.location_id} onChange={e => set('location_id', e.target.value)} required>
            <option value="">— Select location —</option>
            {stockedLocations.map(s => (
              <option key={s.location_id} value={s.location_id}>
                {s.location_code} — Available: {parseFloat(s.qty_available).toFixed(2)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Qty */}
      <Field label="Quantity Issued" required>
        <div className="flex items-center gap-2">
          <input className={clsx(inp, 'flex-1')} type="number" min="0.001" step="any"
            value={form.qty} onChange={e => set('qty', e.target.value)} required />
          {selectedPart && <span className="text-sm text-gray-500 shrink-0">{selectedPart.unit_of_measure}</span>}
        </div>
      </Field>

      {/* Person */}
      <Field label="Issued To" required>
        <select className={sel} value={form.personnel_id} onChange={e => set('personnel_id', e.target.value)} required>
          <option value="">— Select person —</option>
          {activePersonnel.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.department ? ` (${p.department})` : ''}</option>
          ))}
        </select>
      </Field>

      <Field label="Work Order / Job Reference">
        <input className={inp} value={form.work_order} onChange={e => set('work_order', e.target.value)}
          placeholder="e.g. WO-1234, Preventive Maintenance, Scanner #3" />
      </Field>

      <Field label="Purpose / Notes">
        <textarea className={inp} rows={2} value={form.purpose}
          onChange={e => set('purpose', e.target.value)}
          placeholder="Brief description of what the part is for…" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Recording…' : 'Record Issue'}
        </button>
      </div>
    </form>
  );
}

function ReturnUnusedModal({ record, onClose, onSuccess }) {
  const [form, setForm] = useState({
    qty_returned: parseFloat(record.qty).toFixed(2),
    return_condition: 'good',
    return_notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(
    (d) => stockApi.returnCheckout(record.id, d),
    {
      onSuccess: () => { toast.success('Unused part return recorded.'); onSuccess(); onClose(); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed to record return.'),
    }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mut.mutate({
        qty_returned: parseFloat(form.qty_returned),
        return_condition: form.return_condition,
        return_notes: form.return_notes || undefined,
      });
    }} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
        Use this only for parts that were <strong>not used</strong> — e.g. wrong part taken, excess quantity.
        Parts that were used and consumed do not need to be returned.
      </div>

      <div className="bg-gray-50 rounded-lg p-3 text-sm">
        <p className="font-medium text-gray-900">{record.part_description}</p>
        <p className="font-mono text-xs text-gray-500">{record.part_number}</p>
        <p className="text-xs text-gray-600 mt-1">
          Issued to: <strong>{record.officer_name}</strong> ·
          Original qty: <strong>{parseFloat(record.qty)} {record.unit_of_measure}</strong>
        </p>
        {record.work_order && <p className="text-xs text-gray-500 mt-0.5">Job: {record.work_order}</p>}
      </div>

      <Field label="Qty Being Returned" required>
        <div className="flex items-center gap-2">
          <input className={clsx(inp, 'flex-1')} type="number" min="0.001" step="any"
            max={parseFloat(record.qty)} value={form.qty_returned}
            onChange={e => set('qty_returned', e.target.value)} required autoFocus />
          <span className="text-sm text-gray-500 shrink-0">{record.unit_of_measure}</span>
        </div>
      </Field>

      <Field label="Reason for Return" required>
        <select className={sel} value={form.return_condition} onChange={e => set('return_condition', e.target.value)} required>
          <option value="good">Wrong part — in good condition</option>
          <option value="partial">Excess quantity — unused portion returned</option>
          <option value="damaged">Damaged — not installed, returned as defective</option>
        </select>
      </Field>

      <Field label="Notes">
        <textarea className={inp} rows={2} value={form.return_notes}
          onChange={e => set('return_notes', e.target.value)}
          placeholder="Additional details…" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={mut.isLoading}
          className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg disabled:opacity-60">
          {mut.isLoading ? 'Saving…' : 'Record Return'}
        </button>
      </div>
    </form>
  );
}

function CheckoutsTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: 'issued', search: '', from: '', to: '' });
  const [modal, setModal] = useState(null);

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const { data: stats } = useQuery('checkoutStats', stockApi.checkoutStats, { refetchInterval: 60000 });
  const { data, isLoading } = useQuery(
    ['checkouts', filters],
    () => stockApi.listCheckouts({ ...filters, status: filters.status !== 'all' ? filters.status : undefined, limit: 100 }),
    { keepPreviousData: true }
  );

  const rows = data?.rows || [];
  const onMoved = () => {
    qc.invalidateQueries('checkouts');
    qc.invalidateQueries('checkoutStats');
    qc.invalidateQueries('balances');
  };

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={ClipboardList} label="Total Issued"        value={stats?.total ?? '—'}                   color="bg-blue-500" />
        <SummaryCard icon={UserCheck}     label="Still Issued"        value={stats?.issued ?? '—'}                  color="bg-amber-500" sub="not returned" />
        <SummaryCard icon={CheckCircle2}  label="Returned (Unused)"   value={stats?.returned ?? '—'}                color="bg-green-500" />
        <SummaryCard icon={UserCheck}     label="Issued Today"        value={stats?.today ?? '—'}                   color="bg-purple-500" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={clsx(inp, 'pl-8')} placeholder="Search name, part, work order, ref…"
            value={filters.search} onChange={e => setF('search', e.target.value)} />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['issued','Issued'], ['returned','Returned'], ['all','All']].map(([v, l]) => (
            <button key={v} onClick={() => setF('status', v)}
              className={clsx('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filters.status === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
        <input type="date" value={filters.from} onChange={e => setF('from', e.target.value)} className={clsx(sel, 'w-36')} />
        <input type="date" value={filters.to}   onChange={e => setF('to',   e.target.value)} className={clsx(sel, 'w-36')} />
        {hasPermission('stock.checkout') && (
          <button onClick={() => setModal({ type: 'issue' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors ml-auto">
            <PackageMinus size={14} /> Issue Part
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Ref</th>
                <th className="px-4 py-3 text-left">Part</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Issued To</th>
                <th className="px-4 py-3 text-left">Job / Work Order</th>
                <th className="px-4 py-3 text-left">Date Issued</th>
                <th className="px-4 py-3 text-left">Issued By</th>
                <th className="px-4 py-3 text-left">Status</th>
                {hasPermission('stock.checkout') && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={9} className="py-16 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <PackageMinus size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No issue records found.</p>
                  </td>
                </tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.ref}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-500">{r.part_number}</p>
                    <p className="text-xs font-medium text-gray-800 max-w-[200px] truncate" title={r.part_description}>{r.part_description}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-gray-700 whitespace-nowrap">
                    {parseFloat(r.qty).toFixed(2)} <span className="text-gray-400">{r.unit_of_measure}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-gray-800">{r.officer_name}</p>
                    {r.personnel_department && <p className="text-xs text-gray-400">{r.personnel_department}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-700">{r.work_order || <span className="text-gray-300">—</span>}</p>
                    {r.purpose && <p className="text-xs text-gray-400 max-w-[160px] truncate">{r.purpose}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.checked_out_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.return_condition
                      ? <span className="text-gray-400 italic">Returned ({r.return_condition})</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <IssueStatusBadge status={r.status} />
                  </td>
                  {hasPermission('stock.checkout') && (
                    <td className="px-4 py-3 text-right">
                      {r.status === 'issued' && (
                        <button
                          onClick={() => setModal({ type: 'return', record: r })}
                          title="Record unused part return"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded-lg transition-colors ml-auto whitespace-nowrap">
                          <RotateCcw size={11} /> Return Unused
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {data.total} record{data.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {modal?.type === 'issue' && (
        <Modal title="Issue Part from Stores" onClose={() => setModal(null)} wide>
          <IssuePartModal onClose={() => setModal(null)} onSuccess={onMoved} />
        </Modal>
      )}
      {modal?.type === 'return' && (
        <Modal title="Return Unused Part to Stores" onClose={() => setModal(null)}>
          <ReturnUnusedModal record={modal.record} onClose={() => setModal(null)} onSuccess={onMoved} />
        </Modal>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'balances',  label: 'Stock Balances',   icon: Package      },
  { id: 'checkouts', label: 'Parts Issued',      icon: UserCheck    },
  { id: 'reorder',   label: 'Reorder List',      icon: AlertTriangle },
  { id: 'alerts',    label: 'Alerts',            icon: Bell         },
  { id: 'report',    label: 'Movement Report',   icon: FileBarChart2 },
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

      {tab === 'balances'  && <BalancesTab />}
      {tab === 'checkouts' && <CheckoutsTab />}
      {tab === 'reorder'   && <ReorderTab />}
      {tab === 'alerts'    && <AlertsTab />}
      {tab === 'report'    && <MovementReportTab />}
    </div>
  );
}
