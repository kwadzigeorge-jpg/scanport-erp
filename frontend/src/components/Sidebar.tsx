import { NavLink } from 'react-router-dom';
import {
  HomeIcon, CpuChipIcon, DocumentCheckIcon,
  BellAlertIcon, DocumentChartBarIcon, UsersIcon,
  ArrowRightStartOnRectangleIcon, ClipboardDocumentListIcon,
  Cog6ToothIcon, XMarkIcon, ExclamationTriangleIcon, TableCellsIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/',            label: 'Dashboard',        Icon: HomeIcon                  },
  { to: '/incidents',     label: 'Incidents',         Icon: ExclamationTriangleIcon, badge: 'NEW' },
  { to: '/scanner-board', label: 'Scanner Board',     Icon: TableCellsIcon },
  { to: '/scanners',    label: 'Scanners',          Icon: CpuChipIcon               },
  { to: '/certifications', label: 'Certifications', Icon: DocumentCheckIcon         },
  { to: '/notifications',  label: 'NRA Notifications', Icon: BellAlertIcon          },
  { to: '/reports',         label: 'Reports',           Icon: DocumentChartBarIcon  },
  { to: '/agent-requests',  label: 'Agent Requests',    Icon: ArchiveBoxIcon, badge: 'NEW' },
];

const ADMIN_NAV = [
  { to: '/users', label: 'Users',        Icon: UsersIcon                  },
  { to: '/audit', label: 'Audit Log',    Icon: ClipboardDocumentListIcon  },
  { to: '/admin', label: 'System Admin', Icon: Cog6ToothIcon              },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-brand flex flex-col shadow-xl">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📡</span>
          <div>
            <p className="text-white font-bold text-lg leading-tight">ScanPort</p>
            <p className="text-blue-200 text-xs">Operations & Certification</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                {badge}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Admin</p>
            </div>
            {ADMIN_NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user?.name[0]?.toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-blue-300 text-xs capitalize">{user?.role?.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-blue-200 hover:text-white text-sm py-1.5 px-2 rounded hover:bg-white/10 transition"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
