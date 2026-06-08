import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon, MapPinIcon,
  WrenchScrewdriverIcon, BoltIcon, UserIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { createTicket, getLocations, getMeta } from '../../api/incidents';
import type { Location, IncidentMeta } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// Issue types filtered by equipment
const ISSUE_MAP: Record<string, string[]> = {
  'OCR System':            ['OCR Failure', 'No Image After Scan', 'IPS Fault', 'Calibration Required', 'Software Error'],
  'Conveyor':              ['Conveyor Jam', 'Mechanical Fault', 'Power Failure'],
  'Accelerator':           ['Accelerator Major Fault', 'Accelerator Fault', 'Calibration Required', 'Vendor Issue'],
  'Control System':        ['System Down', 'Software Error', 'Network Issue'],
  'Network Infrastructure':['Network Issue', 'System Down'],
  'Power Supply':          ['Power Failure', 'Power Outage', 'Mechanical Fault'],
  'Detector Array':        ['Calibration Required', 'Accelerator Fault', 'Software Error'],
  'Image Processing':      ['No Image After Scan', 'IPS Fault', 'Software Error', 'OCR Failure', 'System Down'],
  'Boom Barrier':          ['Boom Barrier Fault', 'Mechanical Fault', 'Power Failure'],
  'CCTV System':           ['CCTV Fault', 'Power Failure', 'Network Issue', 'Software Error'],
  'Intrusive Platform':    [
    'Truck Breakdown – Towing Required',
    'Traffic Congestion',
    'Shortage of Gangs',
    'Boom Barrier Fault',
    'Daisy Fault',
    'Power Outage',
    'Vehicle Stuck / Breakdown',
    'Other',
  ],
};

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical', desc: 'System down / Operations stopped', color: 'border-red-500 bg-red-50 text-red-800' },
  { value: 'MAJOR',    label: 'Major',    desc: 'Significantly degraded / partial outage', color: 'border-yellow-500 bg-yellow-50 text-yellow-800' },
  { value: 'MINOR',    label: 'Minor',    desc: 'Minor impact / workaround available', color: 'border-green-500 bg-green-50 text-green-700' },
];

export default function TicketForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [meta, setMeta] = useState<IncidentMeta | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    locationId:    '',
    equipmentType: '',
    issueType:     '',
    severity:      '',
    title:         '',
    description:   '',
    assignedTo:    '',
  });

  useEffect(() => {
    Promise.all([getLocations(), getMeta()])
      .then(([locs, m]) => { setLocations(locs); setMeta(m); });
  }, []);

  function set(key: string, val: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      // Auto-clear dependent fields
      if (key === 'equipmentType') next.issueType = '';
      // Auto-suggest title from issue + location
      if (key === 'issueType' || key === 'locationId') {
        const loc = locations.find((l) => l.id === (key === 'locationId' ? val : prev.locationId));
        const issue = key === 'issueType' ? val : prev.issueType;
        if (loc && issue && !prev.title) {
          next.title = `${issue} – ${loc.name}`;
        }
      }
      return next;
    });
  }

  const issueOptions = form.equipmentType
    ? (ISSUE_MAP[form.equipmentType] || meta?.issueTypes || [])
    : (meta?.issueTypes || []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.severity) { toast.error('Please select a severity level.'); return; }
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        locationId:    form.locationId,
        equipmentType: form.equipmentType,
        issueType:     form.issueType,
        severity:      form.severity,
        title:         form.title,
        description:   form.description,
        assignedTo:    form.assignedTo || undefined,
      });
      toast.success(`Ticket ${ticket.ticketNumber} created!`);
      navigate(`/incidents/${ticket.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = form.locationId && form.equipmentType && form.issueType &&
                  form.severity && form.title && form.description;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate('/incidents')} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Log New Incident</h1>
        <p className="text-gray-500 text-sm mt-1">
          Reported by <strong>{user?.name}</strong> · {new Date().toLocaleString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Row 1: Location + Equipment */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPinIcon className="w-5 h-5 text-brand" />
            <h2 className="font-semibold text-gray-700">Location & Equipment</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={form.locationId}
                  onChange={(e) => set('locationId', e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8"
                >
                  <option value="">Select location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Equipment Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={form.equipmentType}
                  onChange={(e) => set('equipmentType', e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8"
                >
                  <option value="">Select equipment…</option>
                  {(meta?.equipmentTypes || []).map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={form.issueType}
                  onChange={(e) => set('issueType', e.target.value)}
                  disabled={!form.equipmentType}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{form.equipmentType ? 'Select issue…' : 'Select equipment first…'}</option>
                  {issueOptions.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <div className="relative">
                <select
                  value={form.assignedTo}
                  onChange={(e) => set('assignedTo', e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8"
                >
                  <option value="">Unassigned</option>
                  {(meta?.assignableTeams || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Severity selector */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-700">Severity <span className="text-red-500">*</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SEVERITY_OPTIONS.map(({ value, label, desc, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('severity', value)}
                className={`relative p-4 rounded-xl border-2 text-left transition ${
                  form.severity === value
                    ? `${color} border-current`
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm">{label}</div>
                <div className="text-xs mt-1 opacity-80">{desc}</div>
                {form.severity === value && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-current flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {form.severity && (
            <p className="mt-3 text-xs text-gray-500">
              SLA:{' '}
              {form.severity === 'CRITICAL' ? '1h first response · 4h resolution' :
               form.severity === 'MAJOR'    ? '2h first response · 8h resolution' :
                                              '4h first response · 24h resolution'}
            </p>
          )}
        </div>

        {/* Row 3: Title + Description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <WrenchScrewdriverIcon className="w-5 h-5 text-brand" />
            <h2 className="font-semibold text-gray-700">Incident Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Brief description of the issue…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
                placeholder="What happened? What is the impact? What has been tried so far?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/incidents')}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              isValid && !submitting
                ? form.severity === 'CRITICAL'
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                  : 'bg-brand hover:opacity-90 text-white shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Logging…
              </>
            ) : (
              <>
                <BoltIcon className="w-4 h-4" />
                Log Incident
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
