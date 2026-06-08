import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CpuChipIcon, CheckBadgeIcon, BellAlertIcon,
  ExclamationCircleIcon, ClockIcon, ShieldExclamationIcon,
  ExclamationTriangleIcon, ArrowUpCircleIcon, CheckCircleIcon,
  BoltIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { getStats, getExpiringList } from '../api/dashboard';
import { getAlerts } from '../api/notifications';
import { getIncidentStats } from '../api/incidents';
import type { DashboardStats, Certification, AlertLog, IncidentStats, Ticket } from '../types';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import AlertBanner from '../components/AlertBanner';

// Simple inline bar chart using Tailwind — no extra dependency needed
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{value}</span>
    </div>
  );
}

// Donut-style ring for SLA compliance
function SlaRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 90 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#dc2626';
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  MAJOR:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  MINOR:    'bg-green-100 text-green-700 border-green-200',
};

const STATUS_DOT: Record<string, string> = {
  OPEN:        'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  ESCALATED:   'bg-red-500',
  RESOLVED:    'bg-green-500',
  CLOSED:      'bg-gray-400',
};

export default function Dashboard() {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [expiring, setExpiring]     = useState<Certification[]>([]);
  const [alerts, setAlerts]         = useState<AlertLog[]>([]);
  const [incStats, setIncStats]     = useState<IncidentStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [incLoading, setIncLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, e, a] = await Promise.all([getStats(), getExpiringList(), getAlerts()]);
      setStats(s); setExpiring(e); setAlerts(a);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInc = useCallback(async () => {
    try {
      const i = await getIncidentStats();
      setIncStats(i);
    } catch { /* incidents module may not be seeded */ }
    finally { setIncLoading(false); }
  }, []);

  useEffect(() => { load(); loadInc(); }, [load, loadInc]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand border-t-transparent" />
    </div>
  );

  const maxLocDowntime = incStats
    ? Math.max(...incStats.byLocation.map((b) => b.totalDowntime), 1)
    : 1;
  const maxIssue = incStats
    ? Math.max(...incStats.byIssueType.map((b) => b._count.id), 1)
    : 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Operational Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'EEEE, dd MMMM yyyy')} · Live operational status
        </p>
      </div>

      <AlertBanner alerts={alerts} onDismiss={load} />

      {/* ── Certification Stats ─────────────────────────────── */}
      <div className="mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Scanner Certifications
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatsCard label="Total Scanners" value={stats!.totalScanners}  Icon={CpuChipIcon}          color="gray"   />
        <StatsCard label="Active"         value={stats!.active}          Icon={CheckBadgeIcon}       color="green"  />
        <StatsCard label="Notice Due"     value={stats!.noticeDue}       Icon={BellAlertIcon}        color="orange" />
        <StatsCard label="Notice Sent"    value={stats!.noticeSent}      Icon={ShieldExclamationIcon} color="blue"  />
        <StatsCard label="Expiring ≤120d" value={stats!.expiring120}     Icon={ClockIcon}            color="indigo" sub="within 120 days" />
        <StatsCard label="Expired"        value={stats!.expired}         Icon={ExclamationCircleIcon} color="red"   />
      </div>

      {/* ── Incident Stats ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Incident Management · Last 30 Days
        </h2>
        <Link to="/incidents" className="text-xs text-brand hover:underline font-medium">
          View all incidents →
        </Link>
      </div>

      {incLoading ? (
        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
          Loading incident data…
        </div>
      ) : incStats ? (
        <>
          {/* Incident KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KpiCard
              label="Open Tickets"
              value={incStats.openTickets}
              icon={<ExclamationTriangleIcon className="w-5 h-5" />}
              color={incStats.openTickets > 0 ? 'red' : 'green'}
            />
            <KpiCard
              label="In Progress"
              value={incStats.inProgressTickets}
              icon={<ClockIcon className="w-5 h-5" />}
              color="yellow"
            />
            <KpiCard
              label="Escalated"
              value={incStats.escalatedTickets}
              icon={<ArrowUpCircleIcon className="w-5 h-5" />}
              color={incStats.escalatedTickets > 0 ? 'red' : 'green'}
            />
            <KpiCard
              label="Resolved Today"
              value={incStats.resolvedToday}
              icon={<CheckCircleIcon className="w-5 h-5" />}
              color="green"
            />
            <KpiCard
              label="MTTR"
              value={incStats.mttrMinutes}
              suffix="min"
              icon={<BoltIcon className="w-5 h-5" />}
              color="blue"
            />
            <KpiCard
              label="Today Downtime"
              value={incStats.totalDowntimeToday}
              suffix="min"
              icon={<ChartBarIcon className="w-5 h-5" />}
              color={incStats.totalDowntimeToday > 120 ? 'red' : 'gray'}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {/* SLA Compliance */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">SLA Compliance Rate</h3>
              <div className="flex items-center justify-center gap-6">
                <SlaRing pct={incStats.slaCompliance} />
                <div className="text-sm space-y-1.5">
                  <div className="text-gray-500">
                    <span className="font-semibold text-gray-800">{incStats.slaCompliance}%</span> compliant
                  </div>
                  <div className={`text-xs font-medium ${
                    incStats.slaCompliance >= 90 ? 'text-green-600' :
                    incStats.slaCompliance >= 70 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {incStats.slaCompliance >= 90 ? 'Excellent' :
                     incStats.slaCompliance >= 70 ? 'Needs Attention' : 'Critical – Review Required'}
                  </div>
                  <div className="text-xs text-gray-400">Based on last 30 days</div>
                </div>
              </div>
            </div>

            {/* Downtime by Location */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Downtime by Scanner (min)</h3>
              {incStats.byLocation.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No downtime recorded.</p>
              ) : (
                <div className="space-y-3">
                  {incStats.byLocation
                    .sort((a, b) => b.totalDowntime - a.totalDowntime)
                    .slice(0, 6)
                    .map((loc) => (
                      <div key={loc.locationId}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="truncate">{loc.locationName}</span>
                          <span className="text-gray-400 ml-2 shrink-0">{loc.ticketCount} tickets</span>
                        </div>
                        <MiniBar
                          value={loc.totalDowntime}
                          max={maxLocDowntime}
                          color={loc.totalDowntime > 240 ? 'bg-red-500' : loc.totalDowntime > 60 ? 'bg-yellow-400' : 'bg-green-500'}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Top Issues */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Top Issue Types</h3>
              {incStats.byIssueType.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No incidents recorded.</p>
              ) : (
                <div className="space-y-3">
                  {incStats.byIssueType.map((iss) => (
                    <div key={iss.issueType}>
                      <div className="text-xs text-gray-600 mb-1 truncate">{iss.issueType}</div>
                      <MiniBar value={iss._count.id} max={maxIssue} color="bg-brand" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Severity breakdown + Active incidents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            {/* Severity pills */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Incidents by Severity (30d)</h3>
              <div className="space-y-3">
                {['CRITICAL', 'MAJOR', 'MINOR'].map((sev) => {
                  const found = incStats.bySeverity.find((b) => b.severity === sev);
                  const count = found?._count?.id ?? 0;
                  const total = incStats.bySeverity.reduce((s, b) => s + b._count.id, 0) || 1;
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border w-20 text-center ${SEV_COLOR[sev]}`}>
                        {sev}
                      </span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sev === 'CRITICAL' ? 'bg-red-500' : sev === 'MAJOR' ? 'bg-yellow-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.max(4, (count / total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active incidents */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Active Incidents</h3>
                <Link to="/incidents?status=OPEN" className="text-xs text-brand hover:underline">View all</Link>
              </div>
              {incStats.recentTickets.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <CheckCircleIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active incidents.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incStats.recentTickets.slice(0, 6).map((ticket) => (
                    <ActiveIncidentRow key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Certification expiry table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Certifications Expiring Within 120 Days</h2>
          <span className="text-sm text-gray-400">{expiring.length} record{expiring.length !== 1 ? 's' : ''}</span>
        </div>
        {expiring.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400">No certifications expiring within 120 days.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Scanner Serial', 'Location', 'Expiry Date', 'Days Left', 'Notice Date', 'Status', 'Notice'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expiring.map((cert) => {
                  const n = cert.notifications?.[0];
                  const rowBg =
                    cert.status === 'EXPIRED'    ? 'bg-red-50' :
                    cert.status === 'NOTICE_DUE' ? 'bg-orange-50' : '';
                  return (
                    <tr key={cert.id} className={`hover:bg-gray-50 transition ${rowBg}`}>
                      <td className="px-4 py-3 font-mono font-medium text-brand">{cert.scanner?.serialNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{cert.scanner?.location || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{format(new Date(cert.expiryDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${(cert.daysToExpiry ?? 0) <= 30 ? 'text-red-600' : 'text-orange-600'}`}>
                          {cert.daysToExpiry} days
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{format(new Date(cert.noticeDate), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3"><StatusBadge status={cert.status} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          n?.noticeStatus === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {n?.noticeStatus === 'SENT' ? 'Sent' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, suffix, icon, color,
}: {
  label: string; value: number; suffix?: string;
  icon: JSX.Element; color: 'red' | 'green' | 'yellow' | 'blue' | 'gray';
}) {
  const colorMap = {
    red:    'bg-red-50 text-red-600 border-red-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    gray:   'bg-gray-50 text-gray-500 border-gray-100',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-2xl font-bold">
        {value}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
      </div>
      <div className="text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function ActiveIncidentRow({ ticket }: { ticket: Ticket }) {
  const isBreached = ticket.slaBreached || ticket.sla?.resolutionBreached;
  return (
    <Link
      to={`/incidents/${ticket.id}`}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition group"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[ticket.status] || 'bg-gray-300'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-brand font-semibold">{ticket.ticketNumber}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold border ${SEV_COLOR[ticket.severity]}`}>
            {ticket.severity}
          </span>
        </div>
        <p className="text-sm text-gray-700 truncate mt-0.5">{ticket.title}</p>
        <p className="text-xs text-gray-400">{ticket.location?.name}</p>
      </div>
      {isBreached && (
        <span className="shrink-0 text-xs bg-red-600 text-white font-bold px-2 py-0.5 rounded">
          SLA!
        </span>
      )}
      <span className="text-brand opacity-0 group-hover:opacity-100 transition text-sm">→</span>
    </Link>
  );
}
