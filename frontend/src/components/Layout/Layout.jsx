import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard, ClipboardList,
  BarChart3, Settings, LogOut, Menu, X, Bell, LayoutGrid,
  FlaskConical, MapPin, CalendarDays, Package, Boxes, ShieldCheck, Scale,
  Sun, Moon, MessageSquare, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',       permission: 'dashboard.view' },
  { to: '/bays',           icon: LayoutGrid,      label: 'Bays View',       permission: 'bay.view' },
  { to: '/bay-allocation', icon: MapPin,          label: 'Bay Allocation',  permission: 'allocation.create' },
  { to: '/marshal',        icon: FlaskConical,    label: 'Holding Area',    permission: 'marshal.confirm_entry' },
  { to: '/transactions',   icon: ClipboardList,   label: 'Transactions',    permission: 'container.view' },
  { to: '/reports',        icon: BarChart3,       label: 'Reports',         permission: 'report.view' },
  { to: '/inventory',      icon: Package,         label: 'Parts Catalogue', permission: 'part.view' },
  { to: '/stock',          icon: Boxes,           label: 'Stock',           permission: 'stock.view' },
  { to: '/compliance',     icon: ShieldCheck,     label: 'Compliance' },
  { to: '/grievances',     icon: Scale,           label: 'Grievances' },
  { to: '/service-feedback', icon: MessageSquare, label: 'Svc Feedback',   permission: 'feedback.view' },
  { to: '/admin',          icon: Settings,        label: 'Admin',           role: 'admin' },
  { to: '/leave',          icon: CalendarDays,    label: 'Leave Mgmt',      roles: ['admin', 'supervisor'] },
];

const roleBadge = {
  admin:        'bg-red-500/20 text-red-300 ring-1 ring-inset ring-red-500/30',
  supervisor:   'bg-purple-500/20 text-purple-300 ring-1 ring-inset ring-purple-500/30',
  booth_officer:'bg-blue-500/20 text-blue-300 ring-1 ring-inset ring-blue-500/30',
  marshal:      'bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
};

export default function Layout() {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const currentPage = visibleNav.find(n => location.pathname.startsWith(n.to));
  const badgeCls = roleBadge[user?.role] || 'bg-slate-500/20 text-slate-300 ring-1 ring-inset ring-slate-500/30';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar (always dark) ───────────────────────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-60 bg-slate-900 flex flex-col transition-transform lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="" className="h-5 w-5 object-contain" onError={e => e.currentTarget.style.display='none'} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm leading-tight tracking-tight">ScanPort</p>
            <p className="text-xs text-slate-500 truncate">Holding Area ERP</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 relative',
                isActive
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-full" />
                  )}
                  <item.icon size={16} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.fullName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {user?.fullName || user?.username}
              </p>
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', badgeCls)}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-slate-800">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            <Menu size={20} />
          </button>

          {/* Page title */}
          {currentPage && (
            <div className="flex items-center gap-2 min-w-0">
              <currentPage.icon size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
              <h1 className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                {currentPage.label}
              </h1>
            </div>
          )}

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="p-1.5 rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors relative">
            <Bell size={17} />
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
