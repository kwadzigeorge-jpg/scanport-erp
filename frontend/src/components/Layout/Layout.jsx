import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, ClipboardList,
  BarChart3, Settings, LogOut, Menu, X, Bell, LayoutGrid,
  FlaskConical, MapPin, CalendarDays, Package, Boxes, ShieldCheck, Scale,
  Sun, Moon, MessageSquare, KeyRound, Eye, EyeOff, Users,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',     permission: 'dashboard.view' },
  { to: '/bays',         icon: LayoutGrid,      label: 'Bays View',     permission: 'bay.view' },
  { to: '/bay-allocation',icon: MapPin,         label: 'Bay Allocation',permission: 'allocation.create' },
  { to: '/marshal',      icon: FlaskConical,    label: 'Holding Area',  permission: 'marshal.confirm_entry' },
  { to: '/transactions', icon: ClipboardList,   label: 'Transactions',  permission: 'container.view' },
  { to: '/reports',      icon: BarChart3,       label: 'Reports',       permission: 'report.view' },
  { to: '/inventory',    icon: Package,         label: 'Parts Catalogue', permission: 'part.view' },
  { to: '/stock',        icon: Boxes,           label: 'Stock',           permission: 'stock.view' },
  { to: '/compliance',   icon: ShieldCheck,     label: 'Compliance' },
  { to: '/grievances',      icon: Scale,           label: 'Grievances' },
  { to: '/gang-allocation', icon: Users,           label: 'Gang Allocation', permission: 'gang.view' },
  { to: '/service-feedback', icon: MessageSquare,  label: 'Svc Feedback', permission: 'feedback.view' },
  { to: '/admin',        icon: Settings,        label: 'Admin',         role: 'admin' },
  { to: '/leave',        icon: CalendarDays,    label: 'Leave Mgmt',    roles: ['admin', 'supervisor'] },
];

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed successfully.');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Change Password</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {[
            { field: 'currentPassword', label: 'Current Password',  key: 'current' },
            { field: 'newPassword',     label: 'New Password',      key: 'new' },
            { field: 'confirmPassword', label: 'Confirm New Password', key: 'confirm' },
          ].map(({ field, label, key }) => (
            <div key={field}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  type={show[key] ? 'text' : 'password'}
                  className="input pr-10"
                  value={form[field]}
                  onChange={e => set(field, e.target.value)}
                  required
                  autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {show[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-400 dark:text-slate-500">Minimum 8 characters.</p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center text-sm py-2">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center text-sm py-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function Layout() {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = navItems.filter(item => {
    if (item.permission) return hasPermission(item.permission);
    if (item.roles) return item.roles.some(r => hasRole(r));
    if (item.role) return hasRole(item.role);
    return true;
  });

  const roleBadge = {
    admin: 'bg-red-100 text-red-800',
    supervisor: 'bg-purple-100 text-purple-800',
    booth_officer: 'bg-blue-100 text-blue-800',
    marshal: 'bg-green-100 text-green-800',
  }[user?.role] || 'bg-gray-100 text-gray-600';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Change Password Modal */}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-transform lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <img src="/logo.png" alt="ScanPort" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-tight">ScanPort</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Holding Area ERP</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-100'
              )}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.fullName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{user?.fullName || user?.username}</p>
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', roleBadge)}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={() => setShowChangePw(true)}
              title="Change password"
              className="text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors"
            >
              <KeyRound size={15} />
            </button>
            <button onClick={handleLogout} title="Logout" className="text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 relative">
            <Bell size={20} />
          </button>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
