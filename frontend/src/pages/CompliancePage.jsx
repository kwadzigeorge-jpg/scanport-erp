import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { complianceApi, partsApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ShieldCheck, AlertTriangle, Clock, Wrench, Zap, FileText,
  Plus, X, Upload, Download, RefreshCw, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Activity, Calendar,
  Search, Filter, BarChart3, Send, Bell, Pencil,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

const MAINT_TYPE_LABELS = {
  corrective_l2:        'Corrective — Level 2',
  corrective_l3:        'Corrective — Level 3',
  pmi_l1:               'PMI — Level 1',
  pmi_l2:               'PMI — Level 2',
  pmi_l3:               'PMI — Level 3',
  level_1_routine:      'Level 1 — Routine',
  level_2_preventive:   'Level 2 — Preventive',
  level_3_major_overhaul: 'Level 3 — Major Overhaul',
  calibration:          'Calibration',
  software_update:      'Software Update',
  hardware_inspection:  'Hardware Inspection',
};
const PMI_VENDOR_MAP = { pmi_l1: 'Scanport', pmi_l2: 'MDE', pmi_l3: 'Smiths Detection' };
const CORRECTIVE_VENDORS = ['MDE', 'Smiths Detection', 'Siemens'];

const CERT_STATUS = {
  issued:               'bg-green-100 text-green-700',
  pending:              'bg-yellow-100 text-yellow-700',
  expired:              'bg-red-100 text-red-700',
  awaiting_inspection:  'bg-blue-100 text-blue-700',
  application_submitted:'bg-purple-100 text-purple-700',
  application_due:      'bg-orange-100 text-orange-700',
  rejected:             'bg-red-200 text-red-800',
};

const SCANNER_STATUS = {
  active:             'bg-green-100 text-green-700',
  inactive:           'bg-gray-100 text-gray-600',
  under_maintenance:  'bg-yellow-100 text-yellow-700',
  decommissioned:     'bg-red-100 text-red-600',
};

const SEVERITY = {
  minor:    'bg-blue-100 text-blue-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  major:    'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const BREAKDOWN_STATUS = {
  open:                'bg-red-100 text-red-700',
  under_investigation: 'bg-yellow-100 text-yellow-700',
  repaired:            'bg-blue-100 text-blue-700',
  closed:              'bg-green-100 text-green-700',
  escalated:           'bg-red-200 text-red-800',
};

const TABS = [
  { key: 'dashboard',    label: 'Dashboard',      icon: BarChart3 },
  { key: 'scanners',     label: 'Scanners',        icon: Activity },
  { key: 'certificates', label: 'Certifications',  icon: ShieldCheck },
  { key: 'meters',       label: 'Survey Meters',   icon: Zap },
  { key: 'maintenance',  label: 'Maintenance',     icon: Wrench },
  { key: 'breakdowns',   label: 'Breakdowns',      icon: AlertTriangle },
  { key: 'annual',       label: 'Annual Report',   icon: FileText },
];

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function Badge({ map, value, label }) {
  return (
    <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
      map[value] || 'bg-gray-100 text-gray-500')}>
      {label || value?.replace(/_/g, ' ') || '—'}
    </span>
  );
}

function DaysChip({ days }) {
  if (days == null) return <span className="text-gray-400 text-xs">—</span>;
  const cls = days < 0   ? 'bg-red-100 text-red-700'
            : days <= 30  ? 'bg-orange-100 text-orange-700'
            : days <= 90  ? 'bg-yellow-100 text-yellow-700'
            : 'bg-green-100 text-green-700';
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cls)}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
    </span>
  );
}

function KPICard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={clsx('bg-white rounded-xl border p-4 flex items-start gap-3',
      accent === 'red'    && 'border-red-200 bg-red-50',
      accent === 'amber'  && 'border-amber-200 bg-amber-50',
      accent === 'green'  && 'border-green-200 bg-green-50',
      !accent             && 'border-gray-200')}>
      {Icon && (
        <div className={clsx('p-2 rounded-lg shrink-0',
          accent === 'red'   ? 'bg-red-100'   :
          accent === 'amber' ? 'bg-amber-100' :
          accent === 'green' ? 'bg-green-100' : 'bg-blue-100')}>
          <Icon size={16} className={
            accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' :
            accent === 'green' ? 'text-green-600' : 'text-blue-600'} />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={clsx('text-2xl font-bold',
          accent === 'red' ? 'text-red-700' : accent === 'amber' ? 'text-amber-700' :
          accent === 'green' ? 'text-green-700' : 'text-gray-900')}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={clsx('bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col',
        wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';

function fmtDate(v) { return v ? format(parseISO(v.slice(0,10)), 'dd MMM yyyy') : '—'; }

function EmptyState({ message }) {
  return <div className="text-center py-16 text-gray-400 text-sm">{message}</div>;
}

function Spinner() {
  return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>;
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading, refetch } = useQuery(
    'compliance-dashboard',
    () => complianceApi.dashboard().then(r => r.data),
    { refetchInterval: 60000 }
  );

  if (isLoading) return <Spinner />;
  const s = data?.scanners || {};
  const m = data?.survey_meters || {};
  const b = data?.breakdowns || {};
  const c = data?.corrective || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Compliance Overview — auto-refreshes every 60s</h2>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KPICard label="Active Scanners"    value={s.scanners_active}       icon={Activity}       accent="green" />
        <KPICard label="Certified"          value={s.scanners_certified}     icon={ShieldCheck}    accent="green" />
        <KPICard label="Expiring ≤ 30 days" value={s.expiring_30d}           icon={Clock}          accent={s.expiring_30d > 0 ? 'amber' : null} />
        <KPICard label="Expired"            value={s.expired}                icon={XCircle}        accent={s.expired > 0 ? 'red' : null} />
        <KPICard label="Application Overdue" value={s.application_overdue}   icon={AlertCircle}    accent={s.application_overdue > 0 ? 'red' : null} />
        <KPICard label="Meters — Cal Due 30d" value={m.calibration_due_30d}  icon={Zap}            accent={m.calibration_due_30d > 0 ? 'amber' : null} />
        <KPICard label="Open Breakdowns"    value={b.open_breakdowns}        icon={AlertTriangle}  accent={b.open_breakdowns > 0 ? 'red' : null} />
        <KPICard label="Open Actions"       value={c.overdue_corrective_actions} icon={Wrench}     accent={c.overdue_corrective_actions > 0 ? 'amber' : null} />
      </div>

      {/* Annual report status */}
      {data?.annual_report && (
        <div className={clsx('rounded-xl border px-4 py-3 flex items-center gap-3',
          data.annual_report.status === 'submitted' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
          <FileText size={16} className={data.annual_report.status === 'submitted' ? 'text-green-600' : 'text-amber-600'} />
          <p className="text-sm font-medium text-gray-800">
            Annual NRA Report {data.annual_report.report_year}:
            <span className="ml-2 font-semibold capitalize">{data.annual_report.status?.replace('_', ' ') || 'Not started'}</span>
            {data.annual_report.version && <span className="text-gray-500 font-normal ml-2">v{data.annual_report.version}</span>}
          </p>
        </div>
      )}

      {/* Upcoming expirations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Certificate Expirations</h3>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Scanner', 'Location', 'Expiry Date', 'Days Left', 'Status', 'Application Deadline', 'Applied'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data?.upcoming_expirations?.length
                ? <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No upcoming expirations</td></tr>
                : data.upcoming_expirations.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{r.scanner_serial}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.location}</td>
                    <td className="px-4 py-2.5 text-gray-700">{fmtDate(r.certificate_expiry_date)}</td>
                    <td className="px-4 py-2.5"><DaysChip days={r.days_remaining} /></td>
                    <td className="px-4 py-2.5"><Badge map={CERT_STATUS} value={r.certification_status} /></td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.application_deadline)}</td>
                    <td className="px-4 py-2.5">
                      {r.application_submitted_date
                        ? <CheckCircle size={14} className="text-green-500" />
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Scanner Modal ────────────────────────────────────────────────────────────
function ScannerModal({ scanner, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    scanner_serial: scanner?.scanner_serial || '',
    accelerator_serial: scanner?.accelerator_serial || '',
    manufacturer: scanner?.manufacturer || '',
    model: scanner?.model || '',
    type: scanner?.type || 'fixed',
    location: scanner?.location || '',
    location_code: scanner?.location_code || '',
    operational_status: scanner?.operational_status || 'active',
    date_commissioned: scanner?.date_commissioned?.slice(0,10) || '',
    nra_source_registration_no: scanner?.nra_source_registration_no || '',
    radiation_source_activity: scanner?.radiation_source_activity || '',
    notes: scanner?.notes || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation(
    d => scanner ? complianceApi.updateScanner(scanner.id, d) : complianceApi.createScanner(d),
    {
      onSuccess: () => {
        toast.success(scanner ? 'Scanner updated.' : 'Scanner registered.');
        qc.invalidateQueries('compliance-scanners');
        qc.invalidateQueries('compliance-dashboard');
        onClose();
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={scanner ? 'Edit Scanner' : 'Register Scanner'} onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scanner Serial" required>
            <input className={inp} value={form.scanner_serial} onChange={e => set('scanner_serial', e.target.value)} required />
          </Field>
          <Field label="Accelerator Serial">
            <input className={inp} value={form.accelerator_serial} onChange={e => set('accelerator_serial', e.target.value)} />
          </Field>
          <Field label="Manufacturer" required>
            <input className={inp} list="manufacturers" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} required />
            <datalist id="manufacturers">
              {['Smiths Detection','Rapiscan','Nuctech','Leidos','Simens'].map(m => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label="Model" required>
            <input className={inp} value={form.model} onChange={e => set('model', e.target.value)} required />
          </Field>
          <Field label="Type">
            <select className={sel} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="fixed">Fixed</option>
              <option value="mobile">Mobile</option>
              <option value="relocatable">Relocatable</option>
            </select>
          </Field>
          <Field label="Operational Status">
            <select className={sel} value={form.operational_status} onChange={e => set('operational_status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </Field>
          <Field label="Location" required>
            <input className={inp} value={form.location} onChange={e => set('location', e.target.value)} required />
          </Field>
          <Field label="Location Code">
            <input className={inp} value={form.location_code} placeholder="e.g. GATE-1" onChange={e => set('location_code', e.target.value)} />
          </Field>
          <Field label="Date Commissioned" required>
            <input type="date" className={inp} value={form.date_commissioned} onChange={e => set('date_commissioned', e.target.value)} required />
          </Field>
          <Field label="NRA Source Reg. No.">
            <input className={inp} value={form.nra_source_registration_no} onChange={e => set('nra_source_registration_no', e.target.value)} />
          </Field>
          <Field label="Radiation Source Activity">
            <input className={inp} value={form.radiation_source_activity} placeholder="e.g. 6 MeV" onChange={e => set('radiation_source_activity', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : scanner ? 'Update' : 'Register'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Scanners Tab ─────────────────────────────────────────────────────────────
function ScannersTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | scanner_obj

  const { data, isLoading } = useQuery(
    ['compliance-scanners', statusFilter],
    () => complianceApi.listScanners({ status: statusFilter || undefined, limit: 100 }).then(r => r.data)
  );

  const rows = (data?.rows || []).filter(r =>
    !search || r.scanner_serial.toLowerCase().includes(search.toLowerCase()) ||
    r.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            placeholder="Search serial / location…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="under_maintenance">Under Maintenance</option>
          <option value="decommissioned">Decommissioned</option>
        </select>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={15} /> Register Scanner
        </button>
      </div>

      {/* Table */}
      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Scanner Serial', 'Accelerator', 'Manufacturer / Model', 'Location', 'Status', 'Cert Status', 'Expiry', 'Days Left', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!rows.length ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No scanners found</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-blue-50/30 cursor-pointer" onClick={() => setModal(r)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{r.scanner_serial}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.accelerator_serial || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.manufacturer} {r.model}</td>
                  <td className="px-4 py-3 text-gray-600">{r.location}</td>
                  <td className="px-4 py-3"><Badge map={SCANNER_STATUS} value={r.operational_status} /></td>
                  <td className="px-4 py-3"><Badge map={CERT_STATUS} value={r.certification_status} /></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.certificate_expiry_date)}</td>
                  <td className="px-4 py-3"><DaysChip days={r.days_until_expiry} /></td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ScannerModal scanner={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Certificate Modal ────────────────────────────────────────────────────────
function CertModal({ cert, scanners, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    scanner_id: cert?.scanner_id || '',
    certificate_type: cert?.certificate_type || 'renewal',
    certification_status: cert?.certification_status || 'pending',
    certificate_number: cert?.certificate_number || '',
    last_inspection_date: cert?.last_inspection_date?.slice(0,10) || '',
    inspector_name: cert?.inspector_name || '',
    inspector_organisation: cert?.inspector_organisation || '',
    certificate_issue_date: cert?.certificate_issue_date?.slice(0,10) || '',
    certificate_expiry_date: cert?.certificate_expiry_date?.slice(0,10) || '',
    application_submitted_date: cert?.application_submitted_date?.slice(0,10) || '',
    application_reference: cert?.application_reference || '',
    is_current: cert?.is_current || false,
    notes: cert?.notes || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const expiryDate = form.certificate_expiry_date;
  const computedDeadline = expiryDate
    ? (() => { const d = new Date(expiryDate); d.setMonth(d.getMonth() - 4); return d.toISOString().slice(0,10); })()
    : null;

  const mut = useMutation(
    d => cert ? complianceApi.updateCertificate(cert.id, d) : complianceApi.createCertificate(d),
    {
      onSuccess: () => {
        toast.success(cert ? 'Certificate updated.' : 'Certificate created.');
        qc.invalidateQueries('compliance-certs');
        qc.invalidateQueries('compliance-dashboard');
        onClose();
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={cert ? 'Edit Certificate' : 'New Certificate Record'} onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scanner" required>
            <select className={sel} value={form.scanner_id} onChange={e => set('scanner_id', e.target.value)} required>
              <option value="">— Select scanner —</option>
              {scanners.map(s => <option key={s.id} value={s.id}>{s.scanner_serial} — {s.location}</option>)}
            </select>
          </Field>
          <Field label="Certificate Type">
            <select className={sel} value={form.certificate_type} onChange={e => set('certificate_type', e.target.value)}>
              <option value="initial">Initial</option>
              <option value="renewal">Renewal</option>
              <option value="provisional">Provisional</option>
              <option value="temporary">Temporary</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={sel} value={form.certification_status} onChange={e => set('certification_status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="awaiting_inspection">Awaiting Inspection</option>
              <option value="application_submitted">Application Submitted</option>
              <option value="issued">Issued</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Certificate Number">
            <input className={inp} value={form.certificate_number} onChange={e => set('certificate_number', e.target.value)} />
          </Field>
          <Field label="Last Inspection Date">
            <input type="date" className={inp} value={form.last_inspection_date} onChange={e => set('last_inspection_date', e.target.value)} />
          </Field>
          <Field label="Inspector Name">
            <input className={inp} value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} />
          </Field>
          <Field label="Inspector Organisation">
            <input className={inp} value={form.inspector_organisation} placeholder="e.g. Nuclear Regulatory Authority" onChange={e => set('inspector_organisation', e.target.value)} />
          </Field>
          <Field label="Certificate Issue Date">
            <input type="date" className={inp} value={form.certificate_issue_date} onChange={e => set('certificate_issue_date', e.target.value)} />
          </Field>
          <Field label="Certificate Expiry Date">
            <input type="date" className={inp} value={form.certificate_expiry_date} onChange={e => set('certificate_expiry_date', e.target.value)} />
          </Field>
          <Field label="Application Deadline" hint="Auto-calculated: expiry minus 4 months">
            <input className={inp} value={computedDeadline || ''} readOnly
              style={{ background: '#f9fafb', color: '#6b7280' }} />
          </Field>
          <Field label="Application Submitted Date">
            <input type="date" className={inp} value={form.application_submitted_date} onChange={e => set('application_submitted_date', e.target.value)} />
          </Field>
          <Field label="Application Reference">
            <input className={inp} value={form.application_reference} onChange={e => set('application_reference', e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_current" checked={form.is_current} onChange={e => set('is_current', e.target.checked)} className="rounded" />
          <label htmlFor="is_current" className="text-sm text-gray-700">Set as current certificate for this scanner</label>
        </div>
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : cert ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Certificates Tab ─────────────────────────────────────────────────────────
function CertificatesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [expiringFilter, setExpiringFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery(
    ['compliance-certs', statusFilter, expiringFilter, showAll],
    () => complianceApi.listCertificates({
      status: statusFilter || undefined,
      expiring_days: expiringFilter || undefined,
      all: showAll ? 'true' : 'false',
    }).then(r => r.data)
  );

  const { data: scanners } = useQuery('compliance-scanners-all',
    () => complianceApi.listScanners({ limit: 200 }).then(r => r.data?.rows || []));

  const handleUpload = async (certId, file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await complianceApi.uploadCertificate(certId, fd);
      toast.success('Certificate uploaded.');
      qc.invalidateQueries('compliance-certs');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed.');
    } finally { setUploading(false); setUploadId(null); }
  };

  const rows = data || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="issued">Issued</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="awaiting_inspection">Awaiting Inspection</option>
          <option value="application_submitted">Application Submitted</option>
          <option value="application_due">Application Due</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={expiringFilter} onChange={e => setExpiringFilter(e.target.value)}>
          <option value="">Any expiry</option>
          <option value="30">Expiring ≤ 30 days</option>
          <option value="60">Expiring ≤ 60 days</option>
          <option value="90">Expiring ≤ 90 days</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-auto">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
          Show history
        </label>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={15} /> New Certificate
        </button>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Scanner', 'Cert No.', 'Status', 'Issue Date', 'Expiry Date', 'App. Deadline', 'Inspector', 'Doc', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!rows.length
                ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No certificates found</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className={clsx('hover:bg-gray-50', r.certification_status === 'expired' && 'bg-red-50/30')}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.scanner_serial}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.certificate_number || '—'}</td>
                    <td className="px-4 py-2.5"><Badge map={CERT_STATUS} value={r.certification_status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.certificate_issue_date)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.certificate_expiry_date)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.application_deadline)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.inspector_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.document_path
                        ? <CheckCircle size={14} className="text-green-500" />
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setModal(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <label className={clsx('text-xs cursor-pointer', uploading && uploadId === r.id ? 'text-gray-400' : 'text-purple-600 hover:underline')}>
                          {uploading && uploadId === r.id ? 'Uploading…' : 'Upload'}
                          <input type="file" accept=".pdf,.jpg,.png" className="hidden"
                            onChange={e => { setUploadId(r.id); handleUpload(r.id, e.target.files[0]); }} />
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CertModal cert={modal === 'new' ? null : modal} scanners={scanners || []} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ─── Survey Meters Tab ────────────────────────────────────────────────────────
function MeterModal({ meter, scanners, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    serial_number: meter?.serial_number || '',
    meter_type: meter?.meter_type || 'geiger_muller',
    manufacturer: meter?.manufacturer || '',
    model: meter?.model || '',
    location: meter?.location || '',
    assigned_to_scanner_id: meter?.assigned_to_scanner_id || '',
    operational_status: meter?.operational_status || 'active',
    date_acquired: meter?.date_acquired?.slice(0,10) || '',
    notes: meter?.notes || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const mut = useMutation(
    d => meter ? complianceApi.updateSurveyMeter(meter.id, d) : complianceApi.createSurveyMeter(d),
    {
      onSuccess: () => { toast.success('Survey meter saved.'); qc.invalidateQueries('compliance-meters'); onClose(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );
  return (
    <Modal title={meter ? 'Edit Survey Meter' : 'Register Survey Meter'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, assigned_to_scanner_id: form.assigned_to_scanner_id || null }); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serial Number" required>
            <input className={inp} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} required />
          </Field>
          <Field label="Meter Type" required>
            <select className={sel} value={form.meter_type} onChange={e => set('meter_type', e.target.value)}>
              <option value="geiger_muller">Geiger-Müller</option>
              <option value="ionisation_chamber">Ionisation Chamber</option>
              <option value="scintillation">Scintillation</option>
              <option value="dosimeter">Dosimeter</option>
              <option value="neutron_rem_meter">Neutron Rem Meter</option>
              <option value="multi_purpose">Multi-Purpose</option>
            </select>
          </Field>
          <Field label="Manufacturer" required>
            <input className={inp} value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} required />
          </Field>
          <Field label="Model" required>
            <input className={inp} value={form.model} onChange={e => set('model', e.target.value)} required />
          </Field>
          <Field label="Location" required>
            <input className={inp} value={form.location} onChange={e => set('location', e.target.value)} required />
          </Field>
          <Field label="Assigned to Scanner">
            <select className={sel} value={form.assigned_to_scanner_id} onChange={e => set('assigned_to_scanner_id', e.target.value)}>
              <option value="">— Pool meter —</option>
              {(scanners || []).map(s => <option key={s.id} value={s.id}>{s.scanner_serial}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={sel} value={form.operational_status} onChange={e => set('operational_status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="under_calibration">Under Calibration</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </Field>
          <Field label="Date Acquired">
            <input type="date" className={inp} value={form.date_acquired} onChange={e => set('date_acquired', e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CalibrationModal({ meterId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    meter_id: meterId,
    calibration_date: today,
    calibration_expiry_date: '',
    calibration_lab: '',
    certificate_number: '',
    result: 'pass',
    technician: '',
    notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const mut = useMutation(complianceApi.logCalibration, {
    onSuccess: () => { toast.success('Calibration logged.'); qc.invalidateQueries('compliance-meters'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  return (
    <Modal title="Log Calibration" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calibration Date" required>
            <input type="date" className={inp} value={form.calibration_date} onChange={e => set('calibration_date', e.target.value)} required />
          </Field>
          <Field label="Calibration Expiry" required>
            <input type="date" className={inp} value={form.calibration_expiry_date} onChange={e => set('calibration_expiry_date', e.target.value)} required />
          </Field>
          <Field label="Calibration Laboratory" required>
            <input className={inp} value={form.calibration_lab} onChange={e => set('calibration_lab', e.target.value)} required />
          </Field>
          <Field label="Certificate Number">
            <input className={inp} value={form.certificate_number} onChange={e => set('certificate_number', e.target.value)} />
          </Field>
          <Field label="Result" required>
            <select className={sel} value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="pass">Pass</option>
              <option value="conditional_pass">Conditional Pass</option>
              <option value="fail">Fail</option>
            </select>
          </Field>
          <Field label="Technician">
            <input className={inp} value={form.technician} onChange={e => set('technician', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Logging…' : 'Log Calibration'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SurveyMetersTab() {
  const [modal, setModal] = useState(null);
  const [calModal, setCalModal] = useState(null);

  const { data, isLoading } = useQuery('compliance-meters',
    () => complianceApi.listSurveyMeters({ limit: 200 }).then(r => r.data));
  const { data: scanners } = useQuery('compliance-scanners-all',
    () => complianceApi.listScanners({ limit: 200 }).then(r => r.data?.rows || []));

  const rows = data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={15} /> Register Meter
        </button>
      </div>
      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Serial', 'Type', 'Manufacturer / Model', 'Location', 'Assigned To', 'Status', 'Last Cal.', 'Cal. Expiry', 'Days Left', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!rows.length
                ? <tr><td colSpan={10} className="text-center py-12 text-gray-400">No survey meters registered</td></tr>
                : rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.serial_number}</td>
                    <td className="px-4 py-2.5 text-gray-600 capitalize">{r.meter_type?.replace(/_/g,' ')}</td>
                    <td className="px-4 py-2.5">{r.manufacturer} {r.model}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.location}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.scanner_serial || '—'}</td>
                    <td className="px-4 py-2.5"><Badge map={SCANNER_STATUS} value={r.operational_status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.last_calibration_date)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.calibration_expiry_date)}</td>
                    <td className="px-4 py-2.5"><DaysChip days={r.days_until_calibration_expiry} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button onClick={() => setModal(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setCalModal(r.id)} className="text-xs text-green-600 hover:underline">Log Cal.</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <MeterModal meter={modal === 'new' ? null : modal} scanners={scanners} onClose={() => setModal(null)} />}
      {calModal && <CalibrationModal meterId={calModal} onClose={() => setCalModal(null)} />}
    </div>
  );
}

// ─── Maintenance Modal ────────────────────────────────────────────────────────
function MaintenanceModal({ scanners, onClose, record }) {
  const qc = useQueryClient();
  const isEdit = !!record;
  const [form, setForm] = useState({
    scanner_id:                  record?.scanner_id          || '',
    maintenance_date:            record?.maintenance_date?.slice(0,10) || today,
    maintenance_end_date:        record?.maintenance_end_date?.slice(0,10) || '',
    maintenance_type:            record?.maintenance_type    || 'pmi_l1',
    description:                 record?.description         || '',
    performed_by_type:           record?.performed_by_type   || 'oem_vendor',
    performed_by_name:           record?.performed_by_name   || '',
    technician_name:             record?.technician_name     || '',
    signed_off_by:               record?.signed_off_by       || '',
    completion_notes:            record?.completion_notes    || '',
    downtime_start:              record?.downtime_start      ? record.downtime_start.slice(0,16) : '',
    downtime_end:                record?.downtime_end        ? record.downtime_end.slice(0,16)   : '',
    scanner_returned_to_service: record?.scanner_returned_to_service || false,
    return_to_service_date:      record?.return_to_service_date?.slice(0,10) || '',
    next_scheduled_maintenance:  record?.next_scheduled_maintenance?.slice(0,10) || '',
    cost:                        record?.cost                || '',
    currency:                    record?.currency            || 'GHS',
    notes:                       record?.notes               || '',
    status:                      record?.status              || 'completed',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const pmiVendor = PMI_VENDOR_MAP[form.maintenance_type];
    if (pmiVendor) {
      setForm(f => ({ ...f, performed_by_name: pmiVendor, performed_by_type: f.performed_by_type === 'internal_technician' ? 'internal_technician' : 'oem_vendor' }));
    }
  }, [form.maintenance_type]);

  const isCompleting = form.status === 'completed';
  const missingCompletion = isCompleting && (!form.maintenance_end_date || !form.signed_off_by);

  const mut = useMutation(
    (data) => isEdit ? complianceApi.updateMaintenance(record.id, data) : complianceApi.logMaintenance(data),
    {
      onSuccess: () => {
        toast.success(isEdit ? 'Maintenance record updated.' : 'Maintenance logged.');
        qc.invalidateQueries('compliance-maintenance');
        onClose();
      },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (missingCompletion) {
      toast.error('Please enter a completion date and sign-off name before marking as Completed.');
      return;
    }
    mut.mutate({ ...form, cost: form.cost || undefined });
  };

  return (
    <Modal title={isEdit ? 'Edit Maintenance Record' : 'Log Maintenance Activity'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scanner" required>
            <select className={sel} value={form.scanner_id} onChange={e => set('scanner_id', e.target.value)} required>
              <option value="">— Select scanner —</option>
              {scanners.map(s => <option key={s.id} value={s.id}>{s.scanner_serial} — {s.location}</option>)}
            </select>
          </Field>
          <Field label="Maintenance Date" required>
            <input type="date" className={inp} value={form.maintenance_date} onChange={e => set('maintenance_date', e.target.value)} required />
          </Field>
          <Field label="Maintenance Type" required>
            <select className={sel} value={form.maintenance_type} onChange={e => set('maintenance_type', e.target.value)}>
              <optgroup label="Preventive Maintenance (PMI)">
                <option value="pmi_l1">PMI — Level 1 (Scanport)</option>
                <option value="pmi_l2">PMI — Level 2 (MDE)</option>
                <option value="pmi_l3">PMI — Level 3 (Smiths Detection)</option>
              </optgroup>
              <optgroup label="Corrective Maintenance">
                <option value="corrective_l2">Corrective — Level 2</option>
                <option value="corrective_l3">Corrective — Level 3</option>
              </optgroup>
            </select>
          </Field>
          <Field label="Status">
            <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Performed By (Type)" required>
            <select className={sel} value={form.performed_by_type} onChange={e => set('performed_by_type', e.target.value)}>
              <option value="oem_vendor">OEM Vendor</option>
              <option value="third_party_vendor">Third-Party Vendor</option>
              <option value="internal_technician">Internal Technician</option>
            </select>
          </Field>
          <Field label="Vendor / Team Name" required>
            {PMI_VENDOR_MAP[form.maintenance_type] ? (
              <input className={clsx(inp, 'bg-gray-50 cursor-not-allowed')} value={form.performed_by_name} readOnly title="Auto-filled based on PMI level" />
            ) : (
              <select className={sel} value={form.performed_by_name} onChange={e => set('performed_by_name', e.target.value)} required>
                <option value="">— Select vendor —</option>
                {CORRECTIVE_VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </Field>
          <Field label="Technician Name">
            <input className={inp} value={form.technician_name} onChange={e => set('technician_name', e.target.value)} />
          </Field>
          <Field label="Cost (GHS)">
            <input type="number" className={inp} value={form.cost} min={0} step="0.01" onChange={e => set('cost', e.target.value)} />
          </Field>
          <Field label="Downtime Start">
            <input type="datetime-local" className={inp} value={form.downtime_start} onChange={e => set('downtime_start', e.target.value)} />
          </Field>
          <Field label="Downtime End">
            <input type="datetime-local" className={inp} value={form.downtime_end} onChange={e => set('downtime_end', e.target.value)} />
          </Field>
          <Field label="Next Scheduled Maintenance">
            <input type="date" className={inp} value={form.next_scheduled_maintenance} onChange={e => set('next_scheduled_maintenance', e.target.value)} />
          </Field>
          <Field label="Return to Service Date">
            <input type="date" className={inp} value={form.return_to_service_date} onChange={e => set('return_to_service_date', e.target.value)} />
          </Field>
        </div>

        <Field label="Description" required>
          <textarea className={inp} rows={3} value={form.description} onChange={e => set('description', e.target.value)} required />
        </Field>
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>

        {/* Completion sign-off — shown when status = completed */}
        {isCompleting && (
          <div className={clsx('rounded-xl border p-4 space-y-3', missingCompletion ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50')}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Completion Sign-off</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Actual Completion Date" required>
                <input type="date" className={clsx(inp, !form.maintenance_end_date && 'border-amber-400')}
                  value={form.maintenance_end_date} onChange={e => set('maintenance_end_date', e.target.value)} />
              </Field>
              <Field label="Signed Off By" required>
                <input className={clsx(inp, !form.signed_off_by && 'border-amber-400')}
                  placeholder="Full name of approver"
                  value={form.signed_off_by} onChange={e => set('signed_off_by', e.target.value)} />
              </Field>
            </div>
            <Field label="Completion Notes">
              <textarea className={inp} rows={2} placeholder="Summary of work done, parts replaced, outcome…"
                value={form.completion_notes} onChange={e => set('completion_notes', e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Maintenance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const MAINT_TYPE_STYLE = {
  pmi_l1: 'bg-blue-50 text-blue-700',
  pmi_l2: 'bg-blue-50 text-blue-700',
  pmi_l3: 'bg-blue-50 text-blue-700',
  corrective_l2: 'bg-orange-50 text-orange-700',
  corrective_l3: 'bg-orange-50 text-orange-700',
};

const MAINT_STATUS_STYLE = {
  completed:   'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  scheduled:   'bg-purple-100 text-purple-700',
  cancelled:   'bg-red-100 text-red-600',
};

const MAINT_STATUS_LABEL = {
  completed: 'Completed', in_progress: 'In Progress',
  scheduled: 'Scheduled', cancelled: 'Cancelled',
};

function MaintenancePartsPanel({ recordId }) {
  const qc = useQueryClient();
  const [partSearch, setPartSearch] = useState('');
  const [newPart, setNewPart] = useState({ part_description: '', quantity: 1, unit_cost: '' });

  const { data: parts = [], isLoading } = useQuery(
    ['maintenance-parts', recordId],
    () => complianceApi.listMaintenanceParts(recordId).then(r => r.data),
    { enabled: !!recordId }
  );
  const { data: catalogue } = useQuery(
    ['parts-search', partSearch],
    () => partsApi.list({ search: partSearch, limit: 10 }).then(r => r.data?.rows || []),
    { enabled: partSearch.length >= 2 }
  );

  const addMut = useMutation(
    (d) => complianceApi.addMaintenancePart(recordId, d),
    { onSuccess: () => { qc.invalidateQueries(['maintenance-parts', recordId]); setNewPart({ part_description: '', quantity: 1, unit_cost: '' }); setPartSearch(''); }, onError: e => toast.error(e.response?.data?.error || 'Failed.') }
  );
  const removeMut = useMutation(
    (pid) => complianceApi.removeMaintenancePart(recordId, pid),
    { onSuccess: () => qc.invalidateQueries(['maintenance-parts', recordId]) }
  );

  const selectCataloguePart = (p) => {
    setNewPart(f => ({ ...f, part_description: p.description, part_number: p.part_number, part_id: p.id }));
    setPartSearch('');
  };

  const totalCost = parts.reduce((s, p) => s + (parseFloat(p.total_cost) || 0), 0);

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Parts / Materials Used</span>
        {totalCost > 0 && <span className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-700">GHS {totalCost.toLocaleString()}</span></span>}
      </div>
      {isLoading ? <p className="text-xs text-gray-400 px-3 py-2">Loading…</p> : (
        <>
          {parts.length > 0 && (
            <table className="w-full text-xs">
              <tbody>
                {parts.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-500">{p.part_number || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-700 flex-1">{p.part_description}</td>
                    <td className="px-3 py-1.5 text-gray-500">×{p.quantity}</td>
                    <td className="px-3 py-1.5 text-gray-600">{p.unit_cost ? `GHS ${Number(p.unit_cost).toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-700">{p.total_cost ? `GHS ${Number(p.total_cost).toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => removeMut.mutate(p.id)} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-3 py-2 space-y-2 bg-white">
            <div className="relative">
              <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Search parts catalogue…" value={partSearch} onChange={e => setPartSearch(e.target.value)} />
              {catalogue?.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-md max-h-36 overflow-y-auto">
                  {catalogue.map(p => (
                    <button key={p.id} onClick={() => selectCataloguePart(p)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 flex gap-2">
                      <span className="font-mono text-gray-400">{p.part_number}</span>
                      <span className="text-gray-700">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Part description *" value={newPart.part_description}
                onChange={e => setNewPart(f => ({ ...f, part_description: e.target.value }))} />
              <input type="number" min={1} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Qty" value={newPart.quantity}
                onChange={e => setNewPart(f => ({ ...f, quantity: e.target.value }))} />
              <input type="number" min={0} step="0.01" className="w-24 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Unit cost" value={newPart.unit_cost}
                onChange={e => setNewPart(f => ({ ...f, unit_cost: e.target.value }))} />
              <button onClick={() => addMut.mutate(newPart)} disabled={!newPart.part_description || addMut.isLoading}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40 shrink-0">
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ScannerHistoryModal({ scanner, onClose }) {
  const { data: rows = [], isLoading } = useQuery(
    ['scanner-history', scanner.id],
    () => complianceApi.scannerHistory(scanner.id).then(r => r.data),
  );

  return (
    <Modal title={`Maintenance History — ${scanner.scanner_serial}`} onClose={onClose} wide>
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {!rows.length ? <EmptyState message="No maintenance history for this scanner." /> : rows.map(r => (
            <div key={r.id} className="flex gap-4 items-start border-l-2 border-blue-200 pl-4 py-2 hover:border-blue-400 transition-colors">
              <div className="shrink-0 w-24 text-xs text-gray-500">{fmtDate(r.maintenance_date)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', MAINT_TYPE_STYLE[r.maintenance_type] || 'bg-gray-100 text-gray-500')}>
                    {MAINT_TYPE_LABELS[r.maintenance_type] || r.maintenance_type?.replace(/_/g,' ')}
                  </span>
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', MAINT_STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-500')}>
                    {MAINT_STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{r.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.performed_by_name}{r.technician_name ? ` · ${r.technician_name}` : ''}{r.downtime_hours ? ` · ${r.downtime_hours}h downtime` : ''}{r.cost ? ` · GHS ${Number(r.cost).toLocaleString()}` : ''}</p>
                {r.completion_notes && <p className="text-xs text-green-700 mt-0.5 italic">"{r.completion_notes}"</p>}
                {r.signed_off_by && <p className="text-xs text-gray-400 mt-0.5">Signed off by {r.signed_off_by}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function MaintenanceRow({ r, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [historyScanner, setHistoryScanner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const qc = useQueryClient();

  const isOverdue = r.next_scheduled_maintenance && new Date(r.next_scheduled_maintenance) < new Date() && r.status !== 'cancelled' && r.status !== 'completed';
  const isSignedOff = !!r.signed_off_by;

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await complianceApi.uploadMaintenanceDoc(r.id, fd);
      toast.success('Document uploaded.');
      qc.invalidateQueries('compliance-maintenance');
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed.'); }
    finally { setUploading(false); }
  };

  return (
    <>
      <tr
        className={clsx('hover:bg-gray-50 cursor-pointer', expanded && 'bg-blue-50/30')}
        onClick={() => setExpanded(x => !x)}
      >
        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{fmtDate(r.maintenance_date)}</td>
        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.scanner_serial}</td>
        <td className="px-4 py-2.5">
          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', MAINT_TYPE_STYLE[r.maintenance_type] || 'bg-gray-100 text-gray-500')}>
            {MAINT_TYPE_LABELS[r.maintenance_type] || r.maintenance_type?.replace(/_/g,' ')}
          </span>
        </td>
        <td className="px-4 py-2.5 text-gray-700">{r.performed_by_name}</td>
        <td className="px-4 py-2.5 text-gray-600">{r.downtime_hours ? `${r.downtime_hours}h` : '—'}</td>
        <td className="px-4 py-2.5 text-gray-600">{r.cost ? Number(r.cost).toLocaleString() : '—'}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', MAINT_STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-500')}>
              {MAINT_STATUS_LABEL[r.status] || r.status}
            </span>
            {isSignedOff && <CheckCircle size={12} className="text-green-500 shrink-0" title={`Signed off by ${r.signed_off_by}`} />}
          </div>
        </td>
        <td className={clsx('px-4 py-2.5 whitespace-nowrap text-sm', isOverdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
          {r.next_scheduled_maintenance ? fmtDate(r.next_scheduled_maintenance) : '—'}
          {isOverdue && <span className="ml-1 text-xs text-red-500">(overdue)</span>}
        </td>
        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit record">
            <Pencil size={14} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={9} className="px-6 py-4 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-3">
              <div><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Description</span><span className="text-gray-700">{r.description || '—'}</span></div>
              <div><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Technician</span><span className="text-gray-700">{r.technician_name || '—'}</span></div>
              <div><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Performed By</span><span className="text-gray-700 capitalize">{r.performed_by_type?.replace(/_/g,' ') || '—'}</span></div>
              <div><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Completed</span><span className="text-gray-700">{r.maintenance_end_date ? fmtDate(r.maintenance_end_date) : '—'}</span></div>
              {(r.downtime_start || r.downtime_end) && (
                <div className="col-span-2"><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Downtime Window</span><span className="text-gray-700">{r.downtime_start ? new Date(r.downtime_start).toLocaleString() : '—'} → {r.downtime_end ? new Date(r.downtime_end).toLocaleString() : '—'}</span></div>
              )}
              {r.completion_notes && <div className="col-span-2"><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Completion Notes</span><span className="text-gray-700">{r.completion_notes}</span></div>}
              {r.signed_off_by && <div><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Signed Off By</span><span className="text-gray-700">{r.signed_off_by} {r.signed_off_at ? `(${new Date(r.signed_off_at).toLocaleDateString()})` : ''}</span></div>}
              {r.notes && <div className="col-span-2"><span className="text-gray-400 text-xs uppercase font-semibold mr-2">Notes</span><span className="text-gray-700">{r.notes}</span></div>}
            </div>

            {/* Parts panel */}
            <MaintenancePartsPanel recordId={r.id} />

            {/* Footer actions */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              {/* Document */}
              {r.document_original_name ? (
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
                  <FileText size={13} /> {r.document_original_name}
                </span>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" className="hidden"
                    onChange={e => handleUpload(e.target.files[0])} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                    <Upload size={13} /> {uploading ? 'Uploading…' : 'Attach service report'}
                  </button>
                </>
              )}
              <button
                onClick={() => setHistoryScanner({ id: r.scanner_id, scanner_serial: r.scanner_serial })}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors ml-auto"
              >
                <Calendar size={13} /> View scanner history
              </button>
            </div>
          </td>
        </tr>
      )}
      {historyScanner && <ScannerHistoryModal scanner={historyScanner} onClose={() => setHistoryScanner(null)} />}
    </>
  );
}

function MaintenanceTab() {
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', scanner_id: '', type: '', status: '' });

  const openEdit = (r) => { setEditRecord(r); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditRecord(null); };

  const { data, isLoading } = useQuery(
    ['compliance-maintenance', filters],
    () => complianceApi.listMaintenance({ ...filters, limit: 100 }).then(r => r.data)
  );
  const { data: scanners } = useQuery('compliance-scanners-all',
    () => complianceApi.listScanners({ limit: 200 }).then(r => r.data?.rows || []));

  const filterSel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" className={filterSel}
          value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        <input type="date" className={filterSel}
          value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        <select className={filterSel} value={filters.scanner_id} onChange={e => setFilters(f => ({ ...f, scanner_id: e.target.value }))}>
          <option value="">All scanners</option>
          {(scanners || []).map(s => <option key={s.id} value={s.id}>{s.scanner_serial} — {s.location}</option>)}
        </select>
        <select className={filterSel} value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          <optgroup label="Preventive (PMI)">
            <option value="pmi_l1">PMI — Level 1</option>
            <option value="pmi_l2">PMI — Level 2</option>
            <option value="pmi_l3">PMI — Level 3</option>
          </optgroup>
          <optgroup label="Corrective">
            <option value="corrective_l2">Corrective — Level 2</option>
            <option value="corrective_l3">Corrective — Level 3</option>
          </optgroup>
        </select>
        <select className={filterSel} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => { setEditRecord(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={15} /> Log Maintenance
        </button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Total Jobs" value={data.total} icon={Wrench} />
          <KPICard label="Total Downtime" value={data.total_downtime_hours ? `${data.total_downtime_hours}h` : '—'} icon={Clock} />
          <KPICard label="Total Cost" value={data.total_cost ? `GHS ${Number(data.total_cost).toLocaleString()}` : '—'} icon={Activity} />
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Scanner', 'Type', 'Vendor / Team', 'Downtime', 'Cost (GHS)', 'Status', 'Next Scheduled', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!data?.rows?.length
                ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No maintenance records</td></tr>
                : data.rows.map(r => <MaintenanceRow key={r.id} r={r} onEdit={openEdit} />)
              }
            </tbody>
          </table>
          {!!data?.rows?.length && (
            <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">Click any row to expand details</p>
          )}
        </div>
      )}

      {showModal && <MaintenanceModal scanners={scanners || []} onClose={closeModal} record={editRecord} />}
    </div>
  );
}

// ─── Breakdown Modal ──────────────────────────────────────────────────────────
function BreakdownModal({ scanners, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    scanner_id: '', breakdown_date: today, severity: 'moderate',
    description_of_failure: '', immediate_action_taken: '',
    scanner_taken_offline: false, offline_start: '',
    vendor_notified: false, vendor_name: '',
    nra_notification_required: false, notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const mut = useMutation(complianceApi.logBreakdown, {
    onSuccess: () => { toast.success('Breakdown logged.'); qc.invalidateQueries('compliance-breakdowns'); qc.invalidateQueries('compliance-dashboard'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  return (
    <Modal title="Log Breakdown" onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scanner" required>
            <select className={sel} value={form.scanner_id} onChange={e => set('scanner_id', e.target.value)} required>
              <option value="">— Select scanner —</option>
              {scanners.map(s => <option key={s.id} value={s.id}>{s.scanner_serial} — {s.location}</option>)}
            </select>
          </Field>
          <Field label="Breakdown Date" required>
            <input type="date" className={inp} value={form.breakdown_date} onChange={e => set('breakdown_date', e.target.value)} required />
          </Field>
          <Field label="Severity" required>
            <select className={sel} value={form.severity} onChange={e => set('severity', e.target.value)}>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
          <Field label="Offline Start">
            <input type="datetime-local" className={inp} value={form.offline_start} onChange={e => set('offline_start', e.target.value)} />
          </Field>
        </div>
        <Field label="Description of Failure" required>
          <textarea className={inp} rows={3} value={form.description_of_failure} onChange={e => set('description_of_failure', e.target.value)} required />
        </Field>
        <Field label="Immediate Action Taken">
          <textarea className={inp} rows={2} value={form.immediate_action_taken} onChange={e => set('immediate_action_taken', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="offline" checked={form.scanner_taken_offline} onChange={e => set('scanner_taken_offline', e.target.checked)} />
            <label htmlFor="offline" className="text-sm text-gray-700">Scanner taken offline</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="vendor" checked={form.vendor_notified} onChange={e => set('vendor_notified', e.target.checked)} />
            <label htmlFor="vendor" className="text-sm text-gray-700">Vendor notified</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="nra" checked={form.nra_notification_required} onChange={e => set('nra_notification_required', e.target.checked)} />
            <label htmlFor="nra" className="text-sm text-gray-700">NRA notification required</label>
          </div>
        </div>
        {form.vendor_notified && (
          <Field label="Vendor Name">
            <input className={inp} list="vendors2" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} />
            <datalist id="vendors2">
              {['Smiths Detection','Siemens','MDE'].map(v => <option key={v} value={v} />)}
            </datalist>
          </Field>
        )}
        <Field label="Notes">
          <textarea className={inp} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          <button type="submit" disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
            {mut.isLoading ? 'Logging…' : 'Log Breakdown'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BreakdownsTab() {
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ status: '', severity: '', from: '', to: '' });

  const { data, isLoading } = useQuery(
    ['compliance-breakdowns', filters],
    () => complianceApi.listBreakdowns({ ...filters, limit: 100 }).then(r => r.data)
  );
  const { data: scanners } = useQuery('compliance-scanners-all',
    () => complianceApi.listScanners({ limit: 200 }).then(r => r.data?.rows || []));
  const qc = useQueryClient();

  const closeBreakdown = useMutation(
    id => complianceApi.updateBreakdown(id, { status: 'closed' }),
    {
      onSuccess: () => { toast.success('Breakdown closed.'); qc.invalidateQueries('compliance-breakdowns'); qc.invalidateQueries('compliance-dashboard'); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_investigation">Under Investigation</option>
          <option value="repaired">Repaired</option>
          <option value="closed">Closed</option>
          <option value="escalated">Escalated</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All severities</option>
          <option value="minor">Minor</option>
          <option value="moderate">Moderate</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={15} /> Log Breakdown
        </button>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Scanner', 'Severity', 'Description', 'Downtime', 'Vendor', 'NRA', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data?.rows?.length
                ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No breakdowns found</td></tr>
                : data.rows.map(r => (
                  <tr key={r.id} className={clsx('hover:bg-gray-50', r.status === 'open' && 'border-l-4 border-red-400')}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.breakdown_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.scanner_serial}</td>
                    <td className="px-4 py-2.5"><Badge map={SEVERITY} value={r.severity} /></td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{r.description_of_failure}</td>
                    <td className="px-4 py-2.5">{r.total_downtime_hours ? `${r.total_downtime_hours}h` : '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.vendor_name || (r.vendor_notified ? '✓' : '—')}</td>
                    <td className="px-4 py-2.5">{r.nra_notification_required ? <AlertCircle size={14} className="text-orange-500" /> : '—'}</td>
                    <td className="px-4 py-2.5"><Badge map={BREAKDOWN_STATUS} value={r.status} /></td>
                    <td className="px-4 py-2.5">
                      {['open','under_investigation','repaired'].includes(r.status) && (
                        <button onClick={() => closeBreakdown.mutate(r.id)}
                          className="text-xs text-green-600 hover:underline whitespace-nowrap">
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <BreakdownModal scanners={scanners || []} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ─── Annual Report Tab ────────────────────────────────────────────────────────
function AnnualReportTab() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: reports, isLoading, refetch } = useQuery(
    ['compliance-annual-report', year],
    () => complianceApi.getAnnualReport(year).then(r => r.data).catch(() => []),
    { retry: false }
  );

  const latest = reports?.[0] || null;

  const generate = async () => {
    setGenerating(true);
    try {
      await complianceApi.generateAnnualReport({ year });
      toast.success(`Annual report for ${year} generated.`);
      qc.invalidateQueries(['compliance-annual-report', year]);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Generation failed.');
    } finally { setGenerating(false); }
  };

  const exportReport = async (format) => {
    setExporting(true);
    try {
      const res = await complianceApi.exportAnnualReport(year, format);
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `NRA-Report-${year}.json`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a'); a.href = url; a.download = `NRA-Report-${year}.xlsx`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Report downloaded.');
    } catch { toast.error('Export failed.'); } finally { setExporting(false); }
  };

  const submitMut = useMutation(
    d => complianceApi.submitAnnualReport(latest?.id, d),
    {
      onSuccess: () => { toast.success('Report marked as submitted.'); refetch(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  const data = latest?.report_data;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Report Year</label>
          <select className={sel} style={{ width: 120 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[currentYear, currentYear-1, currentYear-2, currentYear-3].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <button onClick={generate} disabled={generating}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <RefreshCw size={15} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : 'Generate / Refresh'}
          </button>
        </div>
        {latest && (
          <>
            <div className="mt-4">
              <button onClick={() => exportReport('xlsx')} disabled={exporting}
                className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
                <Download size={15} /> Export XLSX
              </button>
            </div>
            <div className="mt-4">
              <button onClick={() => exportReport('json')} disabled={exporting}
                className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
                <Download size={15} /> Export JSON
              </button>
            </div>
            {latest.status !== 'submitted' && latest.status !== 'acknowledged' && (
              <div className="mt-4">
                <button onClick={() => submitMut.mutate({})}
                  className="flex items-center gap-2 text-sm py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Send size={15} /> Mark as Submitted
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isLoading && <Spinner />}

      {!isLoading && !latest && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No report for {year}. Click "Generate / Refresh" to compile data.
        </div>
      )}

      {latest && (
        <>
          {/* Report header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Annual NRA Report — {year}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Generated {fmtDate(latest.created_at)} · Version {latest.version}
                  {latest.submitted_date && ` · Submitted ${fmtDate(latest.submitted_date)}`}
                </p>
              </div>
              <Badge map={{
                draft: 'bg-gray-100 text-gray-600',
                in_review: 'bg-yellow-100 text-yellow-700',
                approved: 'bg-blue-100 text-blue-700',
                submitted: 'bg-green-100 text-green-700',
                acknowledged: 'bg-green-200 text-green-800',
              }} value={latest.status} />
            </div>
          </div>

          {data && (
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              <KPICard label="Scanners"           value={data.section_1_scanners?.length}       icon={Activity} />
              <KPICard label="Certifications"     value={data.section_2_certifications?.length} icon={ShieldCheck} />
              <KPICard label="Maintenance Jobs"   value={data.section_3_maintenance?.total_activities} icon={Wrench} />
              <KPICard label="Breakdowns"         value={data.section_4_breakdowns?.total_incidents} icon={AlertTriangle} accent={data.section_4_breakdowns?.total_incidents > 0 ? 'amber' : null} />
              <KPICard label="Corrective Actions" value={data.section_5_corrective_actions?.total} icon={CheckCircle} />
              <KPICard label="Repairs"            value={data.section_6_repairs?.total}         icon={Wrench} />
              <KPICard label="Calibrations"       value={data.section_7_survey_meters?.calibrations_in_year} icon={Zap} />
              <KPICard label="Total Maint. Cost"  value={data.section_8_summary?.total_maintenance_cost_ghs ? `GHS ${Number(data.section_8_summary.total_maintenance_cost_ghs).toLocaleString()}` : '—'} icon={Activity} />
            </div>
          )}

          {/* Sections preview */}
          {data?.section_3_maintenance?.records?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Maintenance Activities</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Scanner', 'Date', 'Type', 'Vendor', 'Downtime', 'Cost (GHS)'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.section_3_maintenance.records.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.scanner_serial}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.maintenance_date)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{MAINT_TYPE_LABELS[r.maintenance_type] || r.maintenance_type?.replace(/_/g,' ')}</td>
                        <td className="px-4 py-2.5">{r.performed_by_name}</td>
                        <td className="px-4 py-2.5">{r.downtime_hours ? `${r.downtime_hours}h` : '—'}</td>
                        <td className="px-4 py-2.5">{r.cost ? Number(r.cost).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data?.section_4_breakdowns?.records?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Breakdowns & Incidents</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Scanner', 'Date', 'Severity', 'Description', 'Downtime', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.section_4_breakdowns.records.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.scanner_serial}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(r.breakdown_date)}</td>
                        <td className="px-4 py-2.5"><Badge map={SEVERITY} value={r.severity} /></td>
                        <td className="px-4 py-2.5 max-w-xs truncate text-gray-700">{r.description_of_failure}</td>
                        <td className="px-4 py-2.5">{r.total_downtime_hours ? `${r.total_downtime_hours}h` : '—'}</td>
                        <td className="px-4 py-2.5"><Badge map={BREAKDOWN_STATUS} value={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Notification Bell ────────────────────────────────────────────────────────
const NOTIF_PRIORITY = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();

  const { data: notifs = [] } = useQuery(
    ['compliance-notifications'],
    () => complianceApi.notifications().then(r => r.data),
    { refetchInterval: 60_000 }
  );

  const markRead = useMutation(id => complianceApi.markRead(id), {
    onSuccess: () => qc.invalidateQueries(['compliance-notifications']),
  });

  const triggerMut = useMutation(() => complianceApi.triggerReminders(), {
    onSuccess: () => {
      toast.success('Reminder check complete');
      qc.invalidateQueries(['compliance-notifications']);
    },
    onError: () => toast.error('Reminder check failed'),
  });

  const unread = notifs.filter(n => !n.is_read).length;

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative ml-auto shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        title="Compliance notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col max-h-[480px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">Compliance Alerts</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerMut.mutate()}
                disabled={triggerMut.isLoading}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                title="Run reminder check now"
              >
                {triggerMut.isLoading ? 'Checking…' : 'Check now'}
              </button>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={clsx(
                    'px-4 py-3 border-b border-gray-50 flex gap-3 items-start',
                    !n.is_read && 'bg-blue-50'
                  )}
                >
                  <div className={clsx('mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0',
                    NOTIF_PRIORITY[n.priority] || NOTIF_PRIORITY.low)}>
                    {n.priority?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {format(parseISO(n.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="shrink-0 text-[10px] text-blue-600 hover:underline mt-0.5"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 flex items-center gap-0.5 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            )}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
        <NotificationBell />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {tab === 'dashboard'    && <DashboardTab />}
        {tab === 'scanners'     && <ScannersTab />}
        {tab === 'certificates' && <CertificatesTab />}
        {tab === 'meters'       && <SurveyMetersTab />}
        {tab === 'maintenance'  && <MaintenanceTab />}
        {tab === 'breakdowns'   && <BreakdownsTab />}
        {tab === 'annual'       && <AnnualReportTab />}
      </div>
    </div>
  );
}
