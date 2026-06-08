import { useEffect, useState, useCallback, FormEvent } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { listUsers, deleteUser, register } from '../api/auth';
import type { User } from '../types';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VIEWER' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await listUsers()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(field: string, val: string) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleDelete(u: User) {
    if (!confirm(`Delete user ${u.email}?`)) return;
    try { await deleteUser(u.id); toast.success('User deleted.'); load(); }
    catch { toast.error('Delete failed.'); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await register(form);
      toast.success('User created.');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'VIEWER' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed.');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} users</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition">
          <PlusIcon className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                {['Name', 'Email', 'Role', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{(u as any).createdAt ? format(new Date((u as any).createdAt), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(u)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New User">
        <form onSubmit={submit} className="space-y-4">
          {[
            { label: 'Full Name', field: 'name', type: 'text' },
            { label: 'Email Address', field: 'email', type: 'email' },
            { label: 'Password', field: 'password', type: 'password' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
              <input type={type} value={(form as any)[field]} onChange={(e) => set(field, e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
              <option value="VIEWER">Viewer (read-only)</option>
              <option value="ADMIN">Admin (full access)</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-60">
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
