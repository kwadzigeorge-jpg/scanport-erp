import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { partsApi } from '../services/api';
import {
  Package, Tags, Truck, MapPin, Plus, Pencil, Trash2,
  Search, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Badge({ map, value }) {
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', map[value] || 'bg-gray-100 text-gray-500')}>
      {value?.replace('_', ' ') || '—'}
    </span>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={clsx('bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col', wide ? 'max-w-2xl' : 'max-w-lg')}>
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

function SaveBtn({ loading, label = 'Save' }) {
  return (
    <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-60">
      {loading ? 'Saving…' : label}
    </button>
  );
}

function CancelBtn({ onClick }) {
  return <button type="button" onClick={onClick} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>;
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';

// ─── Parts Tab ────────────────────────────────────────────────────────────────
function PartsTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', category_id: '', criticality: '', page: 1 });
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({});

  const { data, isLoading } = useQuery(
    ['parts', filters],
    () => partsApi.list({
      search:      filters.search      || undefined,
      category_id: filters.category_id || undefined,
      criticality: filters.criticality || undefined,
      page:        filters.page,
      limit:       20,
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: categories } = useQuery('categories', () => partsApi.listCategories().then(r => r.data));
  const { data: suppliers }  = useQuery('suppliers',  () => partsApi.listSuppliers().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.update(modal.data.id, d) : partsApi.create(d),
    {
      onSuccess: () => { toast.success(modal?.data?.id ? 'Part updated.' : 'Part created.'); qc.invalidateQueries('parts'); setModal(null); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed to save.'),
    }
  );

  const deleteMut = useMutation(
    (id) => partsApi.remove(id),
    {
      onSuccess: () => { toast.success('Part obsoleted.'); qc.invalidateQueries('parts'); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const openCreate = () => {
    setForm({ part_number: '', description: '', category_id: '', unit_of_measure: 'EA', unit_cost: 0, reorder_point: 0, reorder_qty: 0, lead_time_days: 7, criticality: 'NON_CRITICAL', primary_supplier_id: '' });
    setModal({ mode: 'create' });
  };

  const openEdit = (p) => {
    setForm({
      part_number:         p.part_number,
      description:         p.description,
      category_id:         p.category_id         || '',
      unit_of_measure:     p.unit_of_measure,
      unit_cost:           p.unit_cost,
      reorder_point:       p.reorder_point,
      reorder_qty:         p.reorder_qty,
      lead_time_days:      p.lead_time_days,
      criticality:         p.criticality,
      primary_supplier_id: p.primary_supplier_id || '',
    });
    setModal({ mode: 'edit', data: p });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.part_number?.trim())  return toast.error('Part number is required.');
    if (!form.description?.trim())  return toast.error('Description is required.');
    saveMut.mutate({
      ...form,
      category_id:         form.category_id         || null,
      primary_supplier_id: form.primary_supplier_id || null,
    });
  };

  const parts      = data?.parts || [];
  const total      = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={clsx(inp, 'pl-8')} placeholder="Search part number or description…"
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select className={clsx(sel, 'w-44')} value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value, page: 1 }))}>
          <option value="">All Categories</option>
          {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={clsx(sel, 'w-40')} value={filters.criticality} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value, page: 1 }))}>
          <option value="">All Criticality</option>
          {['CRITICAL','IMPORTANT','NON_CRITICAL'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
        </select>
        {hasPermission('part.create') && (
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors ml-auto">
            <Plus size={15} /> Add Part
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Part No.</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-left">Criticality</th>
                <th className="px-4 py-3 text-right">Reorder Pt.</th>
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">Loading…</td></tr>
              ) : parts.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">No parts found.</td></tr>
              ) : parts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.part_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.category_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit_of_measure}</td>
                  <td className="px-4 py-3"><Badge map={CRITICALITY_BADGE} value={p.criticality} /></td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.reorder_point}</td>
                  <td className="px-4 py-3"><Badge map={STOCK_STATUS_BADGE} value={p.stock_status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {hasPermission('part.edit') && (
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Pencil size={14} /></button>
                      )}
                      {hasPermission('part.delete') && p.status === 'ACTIVE' && (
                        <button onClick={() => { if (confirm(`Obsolete "${p.description}"?`)) deleteMut.mutate(p.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Obsolete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>Page {filters.page} of {totalPages} ({total} parts)</span>
          <div className="flex gap-1">
            <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Spare Part' : 'Edit Spare Part'} onClose={() => setModal(null)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Part Number" required>
                <input className={inp} value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} placeholder="e.g. HYD-001" required />
              </Field>
              <Field label="Criticality" required>
                <select className={sel} value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value }))}>
                  {['CRITICAL','IMPORTANT','NON_CRITICAL'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Description" required>
              <input className={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Hydraulic Seal Kit 6000 Series" required />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={sel} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Preferred Supplier">
                <select className={sel} value={form.primary_supplier_id} onChange={e => setForm(f => ({ ...f, primary_supplier_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Unit of Measure" required>
                <input className={inp} value={form.unit_of_measure} onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))} placeholder="EA / PCS / KG" required />
              </Field>
              <Field label="Unit Cost (GHS)">
                <input className={inp} type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </Field>
              <Field label="Lead Time (days)">
                <input className={inp} type="number" min="0" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Reorder Point">
                <input className={inp} type="number" min="0" value={form.reorder_point} onChange={e => setForm(f => ({ ...f, reorder_point: e.target.value }))} />
              </Field>
              <Field label="Reorder Qty">
                <input className={inp} type="number" min="0" value={form.reorder_qty} onChange={e => setForm(f => ({ ...f, reorder_qty: e.target.value }))} />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <CancelBtn onClick={() => setModal(null)} />
              <SaveBtn loading={saveMut.isLoading} label={modal.mode === 'create' ? 'Create Part' : 'Save Changes'} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});

  const { data: categories, isLoading } = useQuery('categories', () => partsApi.listCategories().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateCategory(modal.data.id, d) : partsApi.createCategory(d),
    {
      onSuccess: () => { toast.success('Category saved.'); qc.invalidateQueries('categories'); setModal(null); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const deleteMut = useMutation(
    (id) => partsApi.deleteCategory(id),
    {
      onSuccess: () => { toast.success('Deleted.'); qc.invalidateQueries('categories'); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Cannot delete (parts exist).'),
    }
  );

  const openCreate = () => { setForm({ name: '' }); setModal({ mode: 'create' }); };
  const openEdit   = (c) => { setForm({ name: c.name }); setModal({ mode: 'edit', data: c }); };

  return (
    <div className="space-y-4">
      {hasPermission('part.create') && (
        <div className="flex justify-end">
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Category
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Parent</th>
              <th className="px-4 py-3 text-right">Parts</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={4} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : (categories || []).length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-gray-400">No categories yet.</td></tr>
            ) : (categories || []).map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.parent_name || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{c.part_count ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    {hasPermission('part.edit') && (
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                    )}
                    {hasPermission('part.delete') && (
                      <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMut.mutate(c.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Category' : 'Edit Category'} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return toast.error('Name required.'); saveMut.mutate({ name: form.name }); }} className="space-y-4">
            <Field label="Category Name" required>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <CancelBtn onClick={() => setModal(null)} />
              <SaveBtn loading={saveMut.isLoading} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});

  const { data: suppliers, isLoading } = useQuery('suppliers', () => partsApi.listSuppliers().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateSupplier(modal.data.id, d) : partsApi.createSupplier(d),
    {
      onSuccess: () => { toast.success('Supplier saved.'); qc.invalidateQueries('suppliers'); setModal(null); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const blankForm = { name: '', contact_name: '', phone: '', email: '', address: '', lead_time_days: 7 };

  const openCreate = () => { setForm(blankForm); setModal({ mode: 'create' }); };
  const openEdit   = (s) => {
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', lead_time_days: s.lead_time_days || 7 });
    setModal({ mode: 'edit', data: s });
  };

  return (
    <div className="space-y-4">
      {hasPermission('supplier.create') && (
        <div className="flex justify-end">
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Supplier
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-right">Lead Time</th>
                <th className="px-4 py-3 text-right">Parts</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading…</td></tr>
              ) : (suppliers || []).length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No suppliers yet.</td></tr>
              ) : (suppliers || []).map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.lead_time_days ?? '—'} days</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.part_count ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {hasPermission('supplier.edit') && (
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Supplier' : 'Edit Supplier'} onClose={() => setModal(null)} wide>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return toast.error('Name required.'); saveMut.mutate(form); }} className="space-y-4">
            <Field label="Supplier Name" required>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Person">
                <input className={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input className={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Lead Time (days)">
                <input className={inp} type="number" min="0" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} />
              </Field>
            </div>
            <Field label="Address">
              <textarea className={inp} rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <CancelBtn onClick={() => setModal(null)} />
              <SaveBtn loading={saveMut.isLoading} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Locations Tab ────────────────────────────────────────────────────────────
function LocationsTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});

  const { data: locations, isLoading } = useQuery('locations', () => partsApi.listLocations().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateLocation(modal.data.id, d) : partsApi.createLocation(d),
    {
      onSuccess: () => { toast.success('Location saved.'); qc.invalidateQueries('locations'); setModal(null); },
      onError:   (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const openCreate = () => { setForm({ code: '', warehouse: '', shelf: '', bin: '', description: '' }); setModal({ mode: 'create' }); };
  const openEdit   = (l) => { setForm({ code: l.code, warehouse: l.warehouse, shelf: l.shelf || '', bin: l.bin || '', description: l.description || '' }); setModal({ mode: 'edit', data: l }); };

  return (
    <div className="space-y-4">
      {hasPermission('settings.inventory') && (
        <div className="flex justify-end">
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Location
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Warehouse</th>
              <th className="px-4 py-3 text-left">Shelf</th>
              <th className="px-4 py-3 text-left">Bin</th>
              <th className="px-4 py-3 text-right">Parts Stored</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : (locations || []).length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">No locations yet.</td></tr>
            ) : (locations || []).map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{l.warehouse}</td>
                <td className="px-4 py-3 text-gray-500">{l.shelf || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{l.bin || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{l.parts_stored ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {hasPermission('settings.inventory') && (
                    <button onClick={() => openEdit(l)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Location' : 'Edit Location'} onClose={() => setModal(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.code?.trim()) return toast.error('Code required.'); if (!form.warehouse?.trim()) return toast.error('Warehouse required.'); saveMut.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code" required>
                <input className={inp} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. WH-A-01" required autoFocus />
              </Field>
              <Field label="Warehouse" required>
                <input className={inp} value={form.warehouse} onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))} placeholder="e.g. Main Store" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shelf">
                <input className={inp} value={form.shelf} onChange={e => setForm(f => ({ ...f, shelf: e.target.value }))} placeholder="e.g. A" />
              </Field>
              <Field label="Bin">
                <input className={inp} value={form.bin} onChange={e => setForm(f => ({ ...f, bin: e.target.value }))} placeholder="e.g. 01" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inp} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <CancelBtn onClick={() => setModal(null)} />
              <SaveBtn loading={saveMut.isLoading} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'parts',      label: 'Parts Catalogue', icon: Package, permission: 'part.view' },
  { id: 'categories', label: 'Categories',       icon: Tags,    permission: 'part.view' },
  { id: 'suppliers',  label: 'Suppliers',         icon: Truck,   permission: 'supplier.view' },
  { id: 'locations',  label: 'Locations',         icon: MapPin,  permission: 'settings.inventory' },
];

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('parts');

  const visibleTabs = TABS.filter(t => hasPermission(t.permission));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Spare Parts Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage spare parts catalogue, suppliers, and storage locations.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'parts'      && <PartsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'suppliers'  && <SuppliersTab />}
      {tab === 'locations'  && <LocationsTab />}
    </div>
  );
}
