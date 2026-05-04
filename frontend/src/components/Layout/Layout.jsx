import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, ClipboardList,
  BarChart3, Settings, LogOut, Menu, X, Bell, LayoutGrid,
  FlaskConical, MapPin, CalendarDays
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',     permission: 'dashboard:view' },
  { to: '/bays',           icon: LayoutGrid,    label: 'Bays View',      permission: 'dashboard:view' },
  { to: '/bay-allocation', icon: MapPin,        label: 'Bay Allocation', permission: 'container:allocate' },
  { to: '/marshal',        icon: FlaskConical,  label: 'Holding Area',   permission: 'container:confirm_entry' },
  { to: '/transactions', icon: ClipboardList,   label: 'Transactions',  permission: 'container:view' },
  { to: '/reports',      icon: BarChart3,       label: 'Reports',       permission: 'reports:view' },
  { to: '/admin',        icon: Settings,        label: 'Admin',         role: 'admin' },
  { to: '/leave',        icon: CalendarDays,    label: 'Leave Mgmt',    roles: ['admin', 'supervisor'] },
];

export default function Layout() {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const navigate = useNavigate();
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

  const roleBadge = {
    admin: 'bg-red-100 text-red-800',
    supervisor: 'bg-purple-100 text-purple-800',
    booth_officer: 'bg-blue-100 text-blue-800',
    marshal: 'bg-green-100 text-green-800',
  }[user?.role] || 'bg-gray-100 text-gray-600';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <img src="/logo.png" alt="ScanPort" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">ScanPort</p>
            <p className="text-xs text-gray-500">Holding Area ERP</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-gray-400 hover:text-gray-600">
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
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.fullName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName || user?.username}</p>
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', roleBadge)}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button onClick={handleLogout} title="Logout" className="text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button className="text-gray-400 hover:text-gray-600 relative">
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
