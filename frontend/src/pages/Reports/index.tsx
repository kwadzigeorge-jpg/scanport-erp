import { useEffect, useState } from 'react';
import {
  ArrowDownTrayIcon, DocumentTextIcon, TableCellsIcon,
  EnvelopeOpenIcon, MagnifyingGlassIcon, ExclamationTriangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import {
  downloadExpiryPdf, downloadExpiryExcel,
  downloadNoticePdf, downloadNoticeExcel,
  downloadNraLetter,
} from '../../api/reports';
import { listCertifications } from '../../api/certifications';
import { downloadIncidentPdf, downloadIncidentExcel, getLocations } from '../../api/incidents';
import type { Certification, Location } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type Tab = 'certification' | 'incidents';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('certification');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports & Exports</h1>
        <p className="text-gray-500 text-sm mt-1">
          Download operational and certification data in PDF or Excel format
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('certification')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'certification'
              ? 'bg-white text-brand shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Certification Reports
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'incidents'
              ? 'bg-white text-brand shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ExclamationTriangleIcon className="w-4 h-4" />
          Incident Reports
        </button>
      </div>

      {activeTab === 'certification' ? (
        <CertificationReports />
      ) : (
        <IncidentReports />
      )}
    </div>
  );
}

// ─── Certification Reports Tab ────────────────────────────────────────────────

function CertificationReports() {
  const [loading, setLoading]       = useState<string | null>(null);
  const [certs, setCerts]           = useState<Certification[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [search, setSearch]         = useState('');
  const [nraLoading, setNraLoading] = useState<string | null>(null);

  const REPORTS = [
    {
      title: 'Certification Expiry Report',
      description: 'All scanner certifications ordered by expiry date. Includes days-to-expiry and operational status.',
      pdfFn: downloadExpiryPdf,
      excelFn: downloadExpiryExcel,
    },
    {
      title: 'NRA Notice Tracking Report',
      description: 'Full audit trail of NRA notifications — sent dates, methods, reference numbers, and outstanding notices.',
      pdfFn: downloadNoticePdf,
      excelFn: downloadNoticeExcel,
    },
  ];

  useEffect(() => {
    listCertifications()
      .then(setCerts).catch(() => {})
      .finally(() => setCertsLoading(false));
  }, []);

  async function handle(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); toast.success('Report downloaded.'); }
    catch { toast.error('Download failed. Try again.'); }
    finally { setLoading(null); }
  }

  async function handleNraLetter(certId: string) {
    setNraLoading(certId);
    try { await downloadNraLetter(certId); toast.success('NRA letter generated.'); }
    catch { toast.error('Letter generation failed.'); }
    finally { setNraLoading(null); }
  }

  const filtered = certs.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.scanner?.serialNumber?.toLowerCase().includes(q) ||
      c.scanner?.location?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {REPORTS.map((r, i) => (
          <ReportCard
            key={i}
            title={r.title}
            description={r.description}
            onPdf={() => handle(`${i}-pdf`, r.pdfFn)}
            onExcel={() => handle(`${i}-excel`, r.excelFn)}
            pdfLoading={loading === `${i}-pdf`}
            excelLoading={loading === `${i}-excel`}
            disabled={!!loading}
          />
        ))}
      </div>

      {/* NRA Letters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-5">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <EnvelopeOpenIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800">NRA Renewal Request Letters</h3>
            <p className="text-sm text-gray-500 mt-1">
              Generate a formal PDF letter to the Nuclear Regulatory Authority requesting inspection.
            </p>
          </div>
        </div>

        <div className="relative mb-4">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by scanner serial, location, or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {certsLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-7 w-7 border-4 border-brand border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No certifications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Scanner', 'Location', 'Inspection Date', 'Expiry Date', 'Status', ''].map((h) => (
                    <th key={h} className={`px-4 py-3 text-left font-semibold text-gray-600 ${h === '' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{c.scanner?.serialNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{c.scanner?.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.inspectionDate ? format(new Date(c.inspectionDate), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{format(new Date(c.expiryDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'EXPIRED'     ? 'bg-red-100 text-red-700' :
                        c.status === 'NOTICE_DUE'  ? 'bg-orange-100 text-orange-700' :
                        c.status === 'NOTICE_SENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleNraLetter(c.id)}
                        disabled={!!nraLoading}
                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                      >
                        {nraLoading === c.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-400 border-t-transparent" />
                        ) : <ArrowDownTrayIcon className="w-3.5 h-3.5" />}
                        NRA Letter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportNotes items={[
        'Reports reflect real-time data at the time of download.',
        'PDF reports are formatted for printing on A4 landscape paper.',
        'Excel reports include color-coded status columns for easy sorting and filtering.',
        'Notice date is automatically calculated as 4 months before the expiry date.',
        'NRA letters are generated per certification and can be printed on official letterhead.',
      ]} />
    </div>
  );
}

// ─── Incident Reports Tab ─────────────────────────────────────────────────────

function IncidentReports() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState<string | null>(null);

  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [locationId,  setLocationId]  = useState('');
  const [severity,    setSeverity]    = useState('');
  const [status,      setStatus]      = useState('');
  const [issueType,   setIssueType]   = useState('');

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  const filters = {
    dateFrom:   dateFrom || undefined,
    dateTo:     dateTo   || undefined,
    locationId: locationId || undefined,
    severity:   severity   || undefined,
    status:     status     || undefined,
    issueType:  issueType  || undefined,
  };

  async function handleDownload(type: 'pdf' | 'excel') {
    setLoading(type);
    try {
      if (type === 'pdf') await downloadIncidentPdf(filters);
      else                await downloadIncidentExcel(filters);
      toast.success('Report downloaded.');
    } catch {
      toast.error('Download failed. Try again.');
    } finally {
      setLoading(null);
    }
  }

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setLocationId('');
    setSeverity(''); setStatus(''); setIssueType('');
  }

  const hasFilters = dateFrom || dateTo || locationId || severity || status || issueType;

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="w-5 h-5 text-brand" />
          <h3 className="font-semibold text-gray-700">Filter Report</h3>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-red-500 hover:underline">
              Clear filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none">
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none">
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="MAJOR">Major</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none">
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Issue Type</label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-brand outline-none">
              <option value="">All</option>
              {['OCR Failure','System Down','Mechanical Fault','Network Issue','Power Failure',
                'Conveyor Jam','Accelerator Fault','Software Error','Calibration Required'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Incident report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="bg-red-50 p-2.5 rounded-xl shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Incident Summary Report</h3>
              <p className="text-sm text-gray-500 mt-1">
                Full incident log with severity, status, downtime, MTTR, SLA compliance, and resolution details.
                Color-coded by severity (Red = Critical, Yellow = Major, Green = Minor).
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleDownload('pdf')}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {loading === 'pdf' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent" />
              ) : <ArrowDownTrayIcon className="w-4 h-4" />}
              PDF Report
            </button>
            <button
              onClick={() => handleDownload('excel')}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {loading === 'excel' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent" />
              ) : <TableCellsIcon className="w-4 h-4" />}
              Excel Report
            </button>
          </div>
        </div>

        {/* Compliance info card */}
        <div className="bg-gradient-to-br from-brand to-blue-800 rounded-2xl p-6 text-white">
          <h3 className="font-bold text-lg mb-2">What's Included</h3>
          <ul className="text-sm space-y-1.5 text-blue-100">
            <li>✓ Ticket number, location, equipment type</li>
            <li>✓ Issue type, severity, status</li>
            <li>✓ Start time, first response, resolution time</li>
            <li>✓ Total downtime (minutes)</li>
            <li>✓ SLA breach indicator (RED)</li>
            <li>✓ Reported by / Assigned to</li>
            <li>✓ Resolution notes</li>
            <li>✓ Summary sheet (Excel): MTTR, totals, counts</li>
          </ul>
        </div>
      </div>

      <ReportNotes items={[
        'Incident reports are filtered by the criteria selected above. Leave all fields blank for a full export.',
        'Color coding: Red rows = Critical, Yellow = Major, Green = Minor.',
        'Excel report includes a separate Summary sheet with MTTR and KPI totals.',
        'SLA Breached column is highlighted red in Excel for easy identification.',
        'Downtime is calculated from ticket creation to resolution. Active tickets show ongoing time.',
        'Use date filters for weekly/monthly/quarterly regulatory reporting periods.',
      ]} />
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ReportCard({ title, description, onPdf, onExcel, pdfLoading, excelLoading, disabled }: {
  title: string; description: string;
  onPdf: () => void; onExcel: () => void;
  pdfLoading: boolean; excelLoading: boolean; disabled: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-brand/10 p-2.5 rounded-xl shrink-0">
          <DocumentTextIcon className="w-6 h-6 text-brand" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onPdf} disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
          {pdfLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent" />
          ) : <ArrowDownTrayIcon className="w-4 h-4" />}
          PDF
        </button>
        <button onClick={onExcel} disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
          {excelLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent" />
          ) : <TableCellsIcon className="w-4 h-4" />}
          Excel
        </button>
      </div>
    </div>
  );
}

function ReportNotes({ items }: { items: string[] }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
      <h3 className="font-semibold text-blue-800 mb-2">Report Notes</h3>
      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
