import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon,
  ArrowPathIcon, ExclamationTriangleIcon, ClockIcon,
  CheckCircleIcon, ArrowUpCircleIcon,
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { listTickets, getLocations } from '../../api/incidents';
import type { Ticket, Location, TicketStatus, TicketSeverity } from '../../types';

const STATUS_TABS: { key: TicketStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',         label: 'All'        },
  { key: 'OPEN',        label: 'Open'       },
  { key: 'IN_PROGRESS', label: 'In Progress'},
  { key: 'ESCALATED',   label: 'Escalated'  },
  { key: 'RESOLVED',    label: 'Resolved'   },
  { key: 'CLOSED',      label: 'Closed'     },
];

const SEVERITY_COLORS: Record<TicketSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  MAJOR:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  MINOR:    'bg-green-100 text-green-700 border-green-200',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN:        'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ESCALATED:   'bg-red-50 text-red-700 border-red-200',
  RESOLVED:    'bg-green-50 text-green-700 border-green-200',
  CLOSED:      'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_ICONS: Record<TicketStatus, JSX.Element> = {
  OPEN:        <ExclamationTriangleIcon className="w-3.5 h-3.5" />,
  IN_PROGRESS: <ClockIcon className="w-3.5 h-3.5" />,
  ESCALATED:   <ArrowUpCircleIcon className="w-3.5 h-3.5" />,
  RESOLVED:    <CheckCircleIcon className="w-3.5 h-3.5" />,
  CLOSED:      <CheckCircleIcon className="w-3.5 h-3.5" />,
};

export default function Incidents() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);

  const [activeTab, setActiveTab] = useState<TicketStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, locs] = await Promise.all([
        listTickets({
          status:     activeTab === 'ALL' ? undefined : activeTab,
          severity:   severity || undefined,
          locationId: locationId || undefined,
          search:     search || undefined,
          dateFrom:   dateFrom || undefined,
          dateTo:     dateTo || undefined,
          limit:      100,
        }),
        locations.length ? Promise.resolve(locations) : getLocations(),
      ]);
      setTickets(data.tickets);
      setTotal(data.total);
      if (!locations.length) setLocations(locs);
    } catch {
      toast.error('Failed to load incidents.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, severity, locationId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function clearFilters() {
    setSeverity('');
    setLocationId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  }

  const hasActiveFilters = severity || locationId || dateFrom || dateTo || search;

  const tabCounts: Record<string, number> = {};
  STATUS_TABS.forEach(({ key }) => {
    tabCounts[key] = key === 'ALL' ? total :
      tickets.filter((t) => t.status === key).length;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Incident Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {format(new Date(), 'EEEE, dd MMMM yyyy')} · {total} total records
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              hasActiveFilters
                ? 'bg-brand text-white border-brand'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters{hasActiveFilters ? ' (active)' : ''}
          </button>
          <Link
            to="/incidents/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Log Incident
          </Link>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none"
              />
            </div>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand focus:border-brand outline-none"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="MAJOR">Major</option>
              <option value="MINOR">Minor</option>
            </select>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand focus:border-brand outline-none"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand outline-none"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand outline-none"
              title="To date"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-red-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => {
          const count = key === 'ALL' ? total :
            tickets.filter((t) => t.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === key
                  ? 'bg-brand text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No incidents found</p>
            <p className="text-sm mt-1">Try adjusting your filters or log a new incident.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Ticket #', 'Location', 'Issue Type', 'Severity', 'Status', 'Reported', 'Downtime', 'SLA', 'Assigned To', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/incidents/${ticket.id}`)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <MobileCard key={ticket.id} ticket={ticket} onClick={() => navigate(`/incidents/${ticket.id}`)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const sla = ticket.sla;
  const isActive = !['RESOLVED', 'CLOSED'].includes(ticket.status);
  const slaBreached = ticket.slaBreached || (sla?.resolutionBreached && isActive);

  return (
    <tr
      onClick={onClick}
      className={`hover:bg-gray-50 cursor-pointer transition ${
        ticket.severity === 'CRITICAL' && isActive ? 'bg-red-50/50' : ''
      }`}
    >
      <td className="px-4 py-3 font-mono text-xs font-semibold text-brand whitespace-nowrap">
        {ticket.ticketNumber}
      </td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
        <div>{ticket.location?.name || '—'}</div>
        <div className="text-xs text-gray-400">{ticket.equipmentType}</div>
      </td>
      <td className="px-4 py-3 text-gray-700 max-w-[160px]">
        <div className="truncate" title={ticket.title}>{ticket.title}</div>
        <div className="text-xs text-gray-400 truncate">{ticket.issueType}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_COLORS[ticket.severity]}`}>
          {ticket.severity}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[ticket.status]}`}>
          {STATUS_ICONS[ticket.status]}
          {ticket.status.replace('_', ' ')}
        </span>
        {ticket.escalationLevel > 1 && (
          <div className="mt-0.5 text-xs text-orange-600 font-medium">L{ticket.escalationLevel}</div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        <div>{format(new Date(ticket.startTime), 'dd/MM/yy')}</div>
        <div>{format(new Date(ticket.startTime), 'HH:mm')}</div>
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
        {ticket.downtimeMinutes != null
          ? `${ticket.downtimeMinutes}m`
          : isActive ? `${Math.round(sla?.hoursElapsed || 0) * 60}m+` : '—'}
      </td>
      <td className="px-4 py-3">
        {slaBreached ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Breached
          </span>
        ) : isActive && sla ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {sla.minutesRemaining}m left
          </span>
        ) : (
          <span className="text-xs text-gray-400">Met</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
        {ticket.assignedTo || '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-brand text-xs font-medium hover:underline">View →</span>
      </td>
    </tr>
  );
}

function MobileCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const isActive = !['RESOLVED', 'CLOSED'].includes(ticket.status);
  const slaBreached = ticket.slaBreached || (ticket.sla?.resolutionBreached && isActive);

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 ${
        ticket.severity === 'CRITICAL' && isActive ? 'border-l-4 border-l-red-500' :
        ticket.severity === 'MAJOR' && isActive   ? 'border-l-4 border-l-yellow-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="font-mono text-xs font-bold text-brand">{ticket.ticketNumber}</span>
          <p className="font-medium text-gray-800 text-sm mt-0.5 leading-tight">{ticket.title}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_COLORS[ticket.severity]}`}>
            {ticket.severity}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[ticket.status]}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{ticket.location?.name}</span>
        <span>{ticket.equipmentType}</span>
        <span>{formatDistanceToNow(new Date(ticket.startTime), { addSuffix: true })}</span>
        {slaBreached && <span className="text-red-600 font-semibold">SLA Breached</span>}
      </div>
    </div>
  );
}
