import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { partsApi } from '../services/api';
import {
  Package, Tags, Truck, MapPin, Plus, Pencil, Trash2,
  Search, ChevronLeft, ChevronRight, X, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CRITICALITY_BADGE = {
  LOW:      'bg-gray-100 text-gray-600',
  MEDIUM:   'bg-yellow-100 text-yellow-700',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STOCK_STATUS_BADGE = {
  OK:        'bg-green-100 text-green-700',
  LOW:       'bg-yellow-100 text-yellow-700',
  STOCKOUT:  'bg-red-100 text-red-700',
  EXCESS:    'bg-blue-100 text-blue-700',
  UNTRACKED: 'bg-gray-100 text-gray-500',
};

function Badge({ map, value, fallback = value }) {
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', map[value] || 'bg-gray-100 text-gray-600')}>
      {fallback || value}
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

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';

// ─── Parts Tab ────────────────────────────────────────────────────────────────
function PartsTab() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', category_id: '', criticality: '', status: '', page: 1 });
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', data?: {} }
  const [form, setForm] = useState({});

  const { data, isLoading } = useQuery(
    ['parts', filters],
    () => partsApi.list({
      search: filters.search || undefined,
      category_id: filters.category_id || undefined,
      criticality: filters.criticality || undefined,
      status: filters.status || undefined,
      page: filters.page,
      limit: 20,
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: categories } = useQuery('categories', () => partsApi.listCategories().then(r => r.data));
  const { data: suppliers }  = useQuery('suppliers',  () => partsApi.listSuppliers().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.update(modal.data.id, d) : partsApi.create(d),
    {
      onSuccess: () => {
        toast.success(modal?.data?.id ? 'Part updated.' : 'Part created.');
        qc.invalidateQueries('parts');
        setModal(null);
      },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed to save part.'),
    }
  );

  const deleteMut = useMutation(
    (id) => partsApi.remove(id),
    {
      onSuccess: () => { toast.success('Part obsoleted.'); qc.invalidateQueries('parts'); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete.'),
    }
  );

  const openCreate = () => {
    setForm({ criticality: 'MEDIUM', unit_of_measure: 'PCS', reorder_point: 0, reorder_qty: 0, lead_time_days: 7, unit_cost: 0 });
    setModal({ mode: 'create' });
  };

  const openEdit = (part) => {
    setForm({
      part_number: part.part_number,
      name: part.name,
      description: part.description || '',
      category_id: part.category_id || '',
      unit_of_measure: part.unit_of_measure,
      unit_cost: part.unit_cost,
      reorder_point: part.reorder_point,
      reorder_qty: part.reorder_qty,
      criticality: part.criticality,
      preferred_supplier_id: part.preferred_supplier_id || '',
      lead_time_days: part.lead_time_days,
    });
    setModal({ mode: 'edit', data: part });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error('Name is required.');
    saveMut.mutate(form);
  };

  const parts = data?.parts || [];
  const meta  = data?.meta  || { page: 1, totalPages: 1 };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={clsx(inp, 'pl-8')}
            placeholder="Search part number or name…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </div>
        <select className={clsx(sel, 'w-40')} value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value, page: 1 }))}>
          <option value="">All Categories</option>
          {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={clsx(sel, 'w-36')} value={filters.criticality} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value, page: 1 }))}>
          <option value="">All Criticality</option>
          {['LOW','MEDIUM','HIGH','CRITICAL'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className={clsx(sel, 'w-36')} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">All Status</option>
          {['ACTIVE','OBSOLETE'].map(v => <option key={v} value={v}>{v}</option>)}
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
                <th className="px-4 py-3 text-left">Name</th>
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
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit_of_measure}</td>
                  <td className="px-4 py-3"><Badge map={CRITICALITY_BADGE} value={p.criticality} /></td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.reorder_point}</td>
                  <td className="px-4 py-3"><Badge map={STOCK_STATUS_BADGE} value={p.stock_status || 'UNTRACKED'} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {hasPermission('part.edit') && (
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      {hasPermission('part.delete') && p.status === 'ACTIVE' && (
                        <button onClick={() => { if (confirm(`Obsolete "${p.name}"?`)) deleteMut.mutate(p.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Obsolete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>Page {meta.page} of {meta.totalPages} ({meta.total || 0} parts)</span>
          <div className="flex gap-1">
            <button disabled={meta.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button disabled={meta.page >= meta.totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Spare Part' : 'Edit Spare Part'} onClose={() => setModal(null)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Part Number">
                <input className={inp} value={form.part_number || ''} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} placeholder="Auto-generated if blank" />
              </Field>
              <Field label="Name" required>
                <input className={inp} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hydraulic Seal Kit" required />
              </Field>
            </div>

            <Field label="Description">
              <textarea className={inp} rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select className={sel} value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}>
                  <option value="">— None —</option>
                  {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Criticality" required>
                <select className={sel} value={form.criticality || 'MEDIUM'} onChange={e => setForm(f => ({ ...f, criticality: e.target.value }))}>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Unit of Measure" required>
                <input className={inp} value={form.unit_of_measure || ''} onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))} placeholder="PCS / KG / MTR" required />
              </Field>
              <Field label="Unit Cost (GHS)">
                <input className={inp} type="number" min="0" step="0.01" value={form.unit_cost ?? ''} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </Field>
              <Field label="Lead Time (days)">
                <input className={inp} type="number" min="0" value={form.lead_time_days ?? ''} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Reorder Point">
                <input className={inp} type="number" min="0" value={form.reorder_point ?? ''} onChange={e => setForm(f => ({ ...f, reorder_point: e.target.value }))} />
              </Field>
              <Field label="Reorder Qty">
                <input className={inp} type="number" min="0" value={form.reorder_qty ?? ''} onChange={e => setForm(f => ({ ...f, reorder_qty: e.target.value }))} />
              </Field>
            </div>

            <Field label="Preferred Supplier">
              <select className={sel} value={form.preferred_supplier_id || ''} onChange={e => setForm(f => ({ ...f, preferred_supplier_id: e.target.value || null }))}>
                <option value="">— None —</option>
                {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={saveMut.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-60">
                {saveMut.isLoading ? 'Saving…' : modal.mode === 'create' ? 'Create Part' : 'Save Changes'}
              </button>
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
  const [form, setForm] = useState({});

  const { data: categories, isLoading } = useQuery('categories', () => partsApi.listCategories().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateCategory(modal.data.id, d) : partsApi.createCategory(d),
    {
      onSuccess: () => { toast.success('Category saved.'); qc.invalidateQueries('categories'); setModal(null); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const deleteMut = useMutation(
    (id) => partsApi.deleteCategory(id),
    {
      onSuccess: () => { toast.success('Category deleted.'); qc.invalidateQueries('categories'); },
      onError: (e) => toast.error(e.response?.data?.error || 'Cannot delete (parts exist).'),
    }
  );

  const openCreate = () => { setForm({ name: '', code: '', description: '' }); setModal({ mode: 'create' }); };
  const openEdit   = (c) => { setForm({ name: c.name, code: c.code || '', description: c.description || '' }); setModal({ mode: 'edit', data: c }); };

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
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Parts</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : (categories || []).length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">No categories yet.</td></tr>
            ) : (categories || []).map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.code || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.description || '—'}</td>
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
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return toast.error('Name required.'); saveMut.mutate(form); }} className="space-y-4">
            <Field label="Name" required>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </Field>
            <Field label="Code">
              <input className={inp} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. MECH" />
            </Field>
            <Field label="Description">
              <textarea className={inp} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={saveMut.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-60">
                {saveMut.isLoading ? 'Saving…' : 'Save'}
              </button>
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
  const [form, setForm] = useState({});

  const { data: suppliers, isLoading } = useQuery('suppliers', () => partsApi.listSuppliers().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateSupplier(modal.data.id, d) : partsApi.createSupplier(d),
    {
      onSuccess: () => { toast.success('Supplier saved.'); qc.invalidateQueries('suppliers'); setModal(null); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const openCreate = () => setModal({ mode: 'create', data: null }) || setForm({ name: '', contact_person: '', phone: '', email: '', address: '', lead_time_days: 7, payment_terms: '' });
  const openEdit   = (s) => {
    setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', lead_time_days: s.lead_time_days || 7, payment_terms: s.payment_terms || '' });
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-right">Lead Time</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : (suppliers || []).length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No suppliers yet.</td></tr>
            ) : (suppliers || []).map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.supplier_code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.contact_person || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.email || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{s.lead_time_days ?? '—'} days</td>
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

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Supplier' : 'Edit Supplier'} onClose={() => setModal(null)} wide>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return toast.error('Name required.'); saveMut.mutate(form); }} className="space-y-4">
            <Field label="Name" required>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Person">
                <input className={inp} value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
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
            <Field label="Payment Terms">
              <input className={inp} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. Net 30" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={saveMut.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-60">
                {saveMut.isLoading ? 'Saving…' : 'Save'}
              </button>
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
  const [form, setForm] = useState({});

  const { data: locations, isLoading } = useQuery('locations', () => partsApi.listLocations().then(r => r.data));

  const saveMut = useMutation(
    (d) => modal?.data?.id ? partsApi.updateLocation(modal.data.id, d) : partsApi.createLocation(d),
    {
      onSuccess: () => { toast.success('Location saved.'); qc.invalidateQueries('locations'); setModal(null); },
      onError: (e) => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const openCreate = () => { setForm({ name: '', code: '', zone: '', location_type: 'SHELF', capacity: '' }); setModal({ mode: 'create' }); };
  const openEdit   = (l) => { setForm({ name: l.name, code: l.code || '', zone: l.zone || '', location_type: l.location_type, capacity: l.capacity || '' }); setModal({ mode: 'edit', data: l }); };

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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Zone</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Capacity</th>
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
                <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.code || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{l.zone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{l.location_type?.toLowerCase() || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{l.capacity ?? '—'}</td>
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
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return toast.error('Name required.'); saveMut.mutate(form); }} className="space-y-4">
            <Field label="Name" required>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code">
                <input className={inp} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. SH-A1" />
              </Field>
              <Field label="Zone">
                <input className={inp} value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="e.g. Warehouse A" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select className={sel} value={form.location_type} onChange={e => setForm(f => ({ ...f, location_type: e.target.value }))}>
                  {['SHELF','BIN','RACK','YARD','COLD_STORE'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Capacity">
                <input className={inp} type="number" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value || null }))} placeholder="Optional" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={saveMut.isLoading} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-60">
                {saveMut.isLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'parts',      label: 'Parts Catalogue', icon: Package,    permission: 'part.view' },
  { id: 'categories', label: 'Categories',       icon: Tags,       permission: 'part.view' },
  { id: 'suppliers',  label: 'Suppliers',         icon: Truck,      permission: 'supplier.view' },
  { id: 'locations',  label: 'Locations',         icon: MapPin,     permission: 'settings.inventory' },
];

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('parts');

  const visibleTabs = TABS.filter(t => hasPermission(t.permission));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Spare Parts Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage spare parts catalogue, suppliers, and storage locations.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'parts'      && <PartsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'suppliers'  && <SuppliersTab />}
      {tab === 'locations'  && <LocationsTab />}
    </div>
  );
}
