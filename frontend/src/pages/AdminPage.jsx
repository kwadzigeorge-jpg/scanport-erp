import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { usersApi, reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import {
  Settings, UserPlus, Users, Edit, Key, Shield,
  ToggleLeft, ToggleRight, Search, Filter, X,
  Lock, Unlock, LogOut, Eye, Activity, RefreshCw,
  CheckCircle, AlertTriangle, Clock, Monitor, ChevronRight
} from 'lucide-react';

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'users',    label: 'User Management', icon: Users },
  { key: 'sessions', label: 'Active Sessions',  icon: Monitor },
  { key: 'roles',    label: 'Roles & Permissions', icon: Shield },
  { key: 'config',   label: 'System Config',   icon: Settings },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 flex items-center gap-0.5 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'users'    && <UsersPanel />}
        {tab === 'sessions' && <SessionsPanel />}
        {tab === 'roles'    && <RolesPanel />}
        {tab === 'config'   && <ConfigPanel />}
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const { data } = useQuery('user-stats', () => usersApi.stats().then(r => r.data), { refetchInterval: 30000 });
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {[
        { label: 'Total Users',      value: data.total,           color: 'border-gray-300' },
        { label: 'Active',           value: data.active,          color: 'border-green-400' },
        { label: 'Inactive',         value: data.inactive,        color: 'border-gray-300' },
        { label: 'Locked',           value: data.locked,          color: 'border-red-400' },
        { label: 'Logged in Today',  value: data.logged_in_today, color: 'border-blue-400' },
        { label: 'Never Logged In',  value: data.never_logged_in, color: 'border-yellow-400' },
      ].map(s => (
        <div key={s.label} className={clsx('card p-3 text-center border-t-4', s.color)}>
          <p className="text-xl font-bold text-gray-900">{s.value ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Users Panel ──────────────────────────────────────────────────────────────
function UsersPanel() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showCreate, setShowCreate]   = useState(false);
  const [editUser,   setEditUser]     = useState(null);
  const [detailUser, setDetailUser]   = useState(null);
  const [resetUser,  setResetUser]    = useState(null);
  const [filters, setFilters]         = useState({ search: '', role: '', is_active: '' });

  const { data, isLoading, refetch } = useQuery(
    ['admin-users', filters],
    () => usersApi.list({ ...filters, limit: 100 }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: rolesData } = useQuery('roles', () => usersApi.roles().then(r => r.data));

  const toggleMutation = useMutation(
    ({ id, is_active }) => usersApi.update(id, { is_active }),
    {
      onSuccess: (_, vars) => {
        toast.success(vars.is_active ? 'User activated.' : 'User deactivated. Sessions terminated.');
        qc.invalidateQueries('admin-users'); qc.invalidateQueries('user-stats');
      },
      onError: err => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const unlockMutation = useMutation(
    (id) => usersApi.unlock(id),
    {
      onSuccess: () => { toast.success('Account unlocked.'); qc.invalidateQueries('admin-users'); },
      onError: err => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const killSessionsMutation = useMutation(
    (id) => usersApi.killSessions(id),
    {
      onSuccess: (res) => { toast.success(res.data.message); qc.invalidateQueries('admin-users'); },
      onError: err => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const roleBadge = (role) => ({
    admin:         'bg-red-100 text-red-700',
    supervisor:    'bg-purple-100 text-purple-700',
    booth_officer: 'bg-blue-100 text-blue-700',
    marshal:       'bg-green-100 text-green-700',
  }[role] || 'bg-gray-100 text-gray-600');

  const isLocked = (u) => u.locked_until && new Date(u.locked_until) > new Date();

  return (
    <div className="space-y-5">
      <StatsBar />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Search name, username, email..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>
        <select className="input w-auto text-sm" value={filters.role}
          onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}>
          <option value="">All Roles</option>
          {(rolesData || []).map(r => <option key={r.id} value={r.name}>{r.name.replace('_', ' ')}</option>)}
        </select>
        <select className="input w-auto text-sm" value={filters.is_active}
          onChange={e => setFilters(f => ({ ...f, is_active: e.target.value }))}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={() => refetch()} className="btn-secondary text-sm py-2"><RefreshCw size={14} /></button>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm ml-auto">
          <UserPlus size={15} /> New User
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['User', 'Role', 'Status', 'Last Login', 'Sessions', 'Actions'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : !data?.users?.length ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No users found</td></tr>
              ) : data.users.map(u => (
                <tr key={u.id} className={clsx('hover:bg-gray-50/50 transition-colors', !u.is_active && 'opacity-60')}>
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                        u.is_active ? 'bg-blue-500' : 'bg-gray-400'
                      )}>
                        {u.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{u.full_name}</p>
                        <p className="text-xs text-gray-400">@{u.username} · {u.email}</p>
                      </div>
                    </div>
                  </td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', roleBadge(u.role))}>
                      {u.role?.replace('_', ' ')}
                    </span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit',
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-green-500' : 'bg-gray-400')} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {isLocked(u) && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <Lock size={10} /> Locked
                        </span>
                      )}
                      {parseInt(u.active_sessions) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Monitor size={10} /> Online
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Last Login */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.last_login ? format(new Date(u.last_login), 'dd MMM yyyy HH:mm') : <span className="text-gray-300">Never</span>}
                  </td>
                  {/* Sessions */}
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('text-sm font-semibold', parseInt(u.active_sessions) > 0 ? 'text-blue-600' : 'text-gray-300')}>
                      {u.active_sessions}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* View detail */}
                      <ActionBtn title="View Details" icon={Eye} onClick={() => setDetailUser(u)} color="gray" />
                      {/* Edit */}
                      <ActionBtn title="Edit User" icon={Edit} onClick={() => setEditUser(u)} color="blue" />
                      {/* Reset password */}
                      <ActionBtn title="Reset Password" icon={Key} onClick={() => setResetUser(u)} color="orange" />
                      {/* Unlock */}
                      {isLocked(u) && (
                        <ActionBtn title="Unlock Account" icon={Unlock}
                          onClick={() => unlockMutation.mutate(u.id)} color="yellow" />
                      )}
                      {/* Kill sessions */}
                      {parseInt(u.active_sessions) > 0 && u.id !== currentUser?.id && (
                        <ActionBtn title="Terminate Sessions" icon={LogOut}
                          onClick={() => killSessionsMutation.mutate(u.id)} color="red" />
                      )}
                      {/* Toggle active */}
                      {u.id !== currentUser?.id && (
                        <ActionBtn
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          icon={u.is_active ? ToggleRight : ToggleLeft}
                          onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                          color={u.is_active ? 'green' : 'gray'}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
            {data.total} user{data.total !== 1 ? 's' : ''} total
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <UserFormModal
          roles={rolesData || []} mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => { qc.invalidateQueries('admin-users'); qc.invalidateQueries('user-stats'); setShowCreate(false); }}
        />
      )}
      {editUser && (
        <UserFormModal
          roles={rolesData || []} mode="edit" user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { qc.invalidateQueries('admin-users'); setEditUser(null); }}
        />
      )}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
      {detailUser && <UserDetailDrawer userId={detailUser.id} onClose={() => setDetailUser(null)} />}
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, color }) {
  const colors = {
    gray:   'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
    blue:   'text-gray-400 hover:text-blue-600 hover:bg-blue-50',
    orange: 'text-gray-400 hover:text-orange-600 hover:bg-orange-50',
    yellow: 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50',
    red:    'text-gray-400 hover:text-red-600 hover:bg-red-50',
    green:  'text-gray-400 hover:text-green-600 hover:bg-green-50',
  };
  return (
    <button title={title} onClick={onClick}
      className={clsx('p-1.5 rounded-lg transition-colors', colors[color] || colors.gray)}>
      <Icon size={15} />
    </button>
  );
}

// ─── Create / Edit User Modal ─────────────────────────────────────────────────
function UserFormModal({ mode, user, roles, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    username: user?.username || '',
    email:    user?.email || '',
    password: '',
    role:     user?.role || 'booth_officer',
  });
  const [showPw, setShowPw] = useState(false);
  const [pwStrength, setPwStrength] = useState(null);

  const checkStrength = (pw) => {
    if (!pw) { setPwStrength(null); return; }
    const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
    setPwStrength(score);
  };

  const mutation = useMutation(
    (data) => mode === 'create' ? usersApi.create(data) : usersApi.update(user.id, data),
    {
      onSuccess: () => { toast.success(mode === 'create' ? 'User created.' : 'User updated.'); onSaved(); },
      onError: err => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'create') {
      mutation.mutate(form);
    } else {
      const updates = {};
      if (form.fullName !== user.full_name) updates.fullName = form.fullName;
      if (form.email !== user.email)        updates.email = form.email;
      if (form.role !== user.role)          updates.role = form.role;
      if (!Object.keys(updates).length) { toast('No changes to save.'); return; }
      mutation.mutate(updates);
    }
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">{mode === 'create' ? 'Create New User' : `Edit – ${user.username}`}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
          </div>
          {mode === 'create' && (
            <div>
              <label className="label">Username *</label>
              <input className="input lowercase" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} required />
            </div>
          )}
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          {mode === 'create' && (
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="input pr-10"
                  value={form.password} placeholder="Min 8 chars, 1 uppercase, 1 number"
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); checkStrength(e.target.value); }}
                  required />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {pwStrength !== null && (
                <div className="mt-1.5">
                  <div className="flex gap-1 h-1.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={clsx('flex-1 rounded-full transition-colors', i <= pwStrength ? strengthColor[pwStrength] : 'bg-gray-200')} />
                    ))}
                  </div>
                  <p className={clsx('text-xs mt-1', pwStrength <= 1 ? 'text-red-500' : pwStrength <= 2 ? 'text-yellow-600' : 'text-green-600')}>
                    {strengthLabel[pwStrength]} password
                  </p>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {roles.map(r => (
                <option key={r.id} value={r.name}>
                  {r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {roles.find(r => r.name === form.role)?.description}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isLoading} className="btn-primary flex-1 justify-center">
              {mutation.isLoading
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : mode === 'create' ? 'Create User' : 'Save Changes'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const mutation = useMutation(() => usersApi.resetPassword(user.id, { newPassword: pw }), {
    onSuccess: () => { toast.success('Password reset. All sessions terminated.'); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed.'),
  });

  const valid = pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && pw === confirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">Reset Password</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>Resetting password for <strong>{user.full_name}</strong> will immediately terminate all their active sessions.</span>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input pr-12"
                value={pw} placeholder="Min 8 chars, 1 uppercase, 1 number"
                onChange={e => setPw(e.target.value)} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" className={clsx('input', confirm && pw !== confirm ? 'border-red-400' : '')}
              value={confirm} placeholder="Re-enter password" onChange={e => setConfirm(e.target.value)} />
            {confirm && pw !== confirm && <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={!valid || mutation.isLoading}
              className="flex-1 btn-primary justify-center bg-orange-500 hover:bg-orange-600">
              {mutation.isLoading
                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Reset Password'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────
function UserDetailDrawer({ userId, onClose }) {
  const { data, isLoading } = useQuery(['user-detail', userId], () => usersApi.get(userId).then(r => r.data));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">User Details</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : data ? (
          <div className="p-5 space-y-5 flex-1">
            {/* Profile */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                {data.full_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">{data.full_name}</p>
                <p className="text-gray-500 text-sm">@{data.username}</p>
                <p className="text-gray-400 text-xs">{data.email}</p>
              </div>
            </div>

            {/* Info grid */}
            <div className="card p-4 space-y-2 text-sm">
              {[
                ['Role',        data.role?.replace(/_/g, ' ')],
                ['Status',      data.is_active ? 'Active' : 'Inactive'],
                ['Last Login',  data.last_login ? format(new Date(data.last_login), 'dd MMM yyyy HH:mm') : 'Never'],
                ['Created',     format(new Date(data.created_at), 'dd MMM yyyy')],
                ['Created By',  data.created_by_username || 'System'],
                ['Failed Logins', data.failed_login_attempts || 0],
                ['Locked Until', data.locked_until && new Date(data.locked_until) > new Date()
                  ? format(new Date(data.locked_until), 'dd MMM HH:mm') : 'Not locked'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900 text-right capitalize">{val}</span>
                </div>
              ))}
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Shield size={14} /> Permissions ({data.permissions?.length || 0})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(data.permissions || []).map(p => (
                  <span key={p.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    <CheckCircle size={10} /> {p.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Activity size={14} /> Recent Activity
              </h3>
              <div className="space-y-1.5">
                {(data.recent_activity || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No recent activity</p>
                ) : data.recent_activity.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-gray-700 font-medium flex-1">{a.action}</span>
                    <span className="text-gray-400 shrink-0">{format(new Date(a.created_at), 'dd MMM HH:mm')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Sessions Panel ───────────────────────────────────────────────────────────
function SessionsPanel() {
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const { data, isLoading, refetch } = useQuery(
    'active-sessions', () => usersApi.sessions().then(r => r.data), { refetchInterval: 15000 }
  );

  const killMutation = useMutation(
    (sid) => usersApi.killSession(sid),
    {
      onSuccess: () => { toast.success('Session terminated.'); qc.invalidateQueries('active-sessions'); },
      onError: err => toast.error(err.response?.data?.error || 'Failed.'),
    }
  );

  const roleBadge = (role) => ({
    admin:         'bg-red-100 text-red-700',
    supervisor:    'bg-purple-100 text-purple-700',
    booth_officer: 'bg-blue-100 text-blue-700',
    marshal:       'bg-green-100 text-green-700',
  }[role] || 'bg-gray-100 text-gray-600');

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Active Sessions</h2>
          <p className="text-sm text-gray-500">{(data || []).length} user{(data || []).length !== 1 ? 's' : ''} currently logged in</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['User', 'Role', 'IP Address', 'Last Active', 'Logged In', 'Action'].map(h =>
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            )}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : !(data || []).length ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No active sessions</td></tr>
            ) : (data || []).map(s => (
              <tr key={s.id} className={clsx('hover:bg-gray-50/50', s.user_id === me?.id && 'bg-blue-50/40')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <div>
                      <p className="font-semibold text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">@{s.username}</p>
                    </div>
                    {s.user_id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">You</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', roleBadge(s.role))}>
                    {s.role?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.ip_address || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {format(new Date(s.last_active), 'HH:mm:ss')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {format(new Date(s.created_at), 'dd MMM HH:mm')}
                </td>
                <td className="px-4 py-3">
                  {s.user_id !== me?.id && (
                    <button onClick={() => killMutation.mutate(s.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg border border-red-200 transition-colors">
                      <LogOut size={12} /> Terminate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Roles & Permissions Panel ────────────────────────────────────────────────
function RolesPanel() {
  const [selectedRole, setSelectedRole] = useState(null);
  const { data: roles, isLoading } = useQuery('roles-detail', () => usersApi.roles().then(r => r.data));
  const { data: allPerms } = useQuery('permissions', () => usersApi.permissions().then(r => r.data));

  const roleColors = {
    admin:         { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700' },
    supervisor:    { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
    booth_officer: { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
    marshal:       { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  };

  // Group permissions by prefix
  const grouped = {};
  (allPerms || []).forEach(p => {
    const [group] = p.name.split(':');
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(p);
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Role cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(roles || []).map(role => {
          const colors = roleColors[role.name] || { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' };
          return (
            <button key={role.id}
              onClick={() => setSelectedRole(selectedRole?.id === role.id ? null : role)}
              className={clsx('text-left rounded-xl border-2 p-4 transition-all hover:shadow-md',
                colors.bg, selectedRole?.id === role.id ? colors.border + ' shadow-md' : 'border-transparent hover:' + colors.border
              )}>
              <div className="flex items-start justify-between">
                <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-bold capitalize', colors.badge)}>
                  {role.name.replace(/_/g, ' ')}
                </span>
                <ChevronRight size={15} className={clsx('text-gray-400 transition-transform', selectedRole?.id === role.id && 'rotate-90')} />
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-snug">{role.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-500"><strong className="text-gray-900">{role.user_count}</strong> active users</span>
                <span className="text-xs text-gray-500"><strong className="text-gray-900">{role.permissions?.length || 0}</strong> permissions</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Permission matrix */}
      {selectedRole && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 capitalize">
              Permissions: {selectedRole.name.replace(/_/g, ' ')}
            </h3>
            <span className="text-sm text-gray-500">{selectedRole.permissions?.length || 0} of {allPerms?.length} permissions</span>
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(grouped).map(([group, perms]) => (
              <div key={group}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{group}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perms.map(p => {
                    const hasIt = selectedRole.permissions?.includes(p.name);
                    return (
                      <div key={p.name} className={clsx(
                        'flex items-start gap-2 p-2.5 rounded-lg border text-xs',
                        hasIt ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-50'
                      )}>
                        {hasIt
                          ? <CheckCircle size={13} className="text-green-600 shrink-0 mt-0.5" />
                          : <X size={13} className="text-gray-400 shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className={clsx('font-mono font-semibold', hasIt ? 'text-green-800' : 'text-gray-400')}>{p.name}</p>
                          <p className="text-gray-400 leading-tight">{p.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel() {
  const qc = useQueryClient();
  const { data } = useQuery('system-config', () => reportsApi.config().then(r => r.data));
  const [editing, setEditing] = useState({});

  const mutation = useMutation(reportsApi.updateConfig, {
    onSuccess: () => { toast.success('Config saved.'); qc.invalidateQueries('system-config'); setEditing({}); },
    onError: err => toast.error(err.response?.data?.error || 'Failed.'),
  });

  const configGroups = {
    'Session & Security': ['overstay_threshold_hours', 'session_inactivity_minutes', 'prevent_concurrent_sessions', 'max_failed_logins', 'lockout_minutes'],
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-semibold text-gray-900">System Configuration</h2>
        <p className="text-sm text-gray-500 mt-0.5">Changes take effect immediately for new sessions.</p>
      </div>
      <div className="card overflow-hidden divide-y divide-gray-50">
        {(data || []).map(cfg => (
          <div key={cfg.key} className="px-5 py-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-semibold text-gray-900">{cfg.key}</p>
              <p className="text-xs text-gray-400 mt-0.5">{cfg.description}</p>
            </div>
            {editing[cfg.key] !== undefined ? (
              <div className="flex items-center gap-2 shrink-0">
                <input className="input w-28 text-center text-sm py-1.5"
                  value={editing[cfg.key]}
                  onChange={e => setEditing(ed => ({ ...ed, [cfg.key]: e.target.value }))} />
                <button onClick={() => mutation.mutate({ key: cfg.key, value: editing[cfg.key] })}
                  className="btn-primary text-xs px-3 py-1.5">Save</button>
                <button onClick={() => setEditing(ed => { const n = { ...ed }; delete n[cfg.key]; return n; })}
                  className="btn-secondary text-xs px-2 py-1.5"><X size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <span className={clsx('text-sm font-bold font-mono px-2.5 py-0.5 rounded',
                  cfg.value === 'true' ? 'bg-green-100 text-green-700' :
                  cfg.value === 'false' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700'
                )}>{cfg.value}</span>
                <button onClick={() => setEditing(ed => ({ ...ed, [cfg.key]: cfg.value }))}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
