import React, { useState } from 'react';
import { integrityApi } from '../services/api';
import clsx from 'clsx';
import { ShieldAlert, CheckCircle2, Loader2, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const INCIDENT_TYPES = [
  { value: 'bay_solicitation',      label: 'Staff demanded payment to assign me a bay' },
  { value: 'payment_demand',        label: 'Staff demanded payment for any other reason' },
  { value: 'bribe_accepted',        label: 'I paid money to a staff member (willingly or under pressure)' },
  { value: 'preferential_treatment',label: 'I witnessed someone receive preferential bay treatment' },
  { value: 'witness_only',          label: 'I witnessed corruption but was not personally involved' },
  { value: 'other',                 label: 'Other integrity concern' },
];

function Field({ label, required, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function IntegrityReportPage() {
  const [form, setForm] = useState({
    incident_type: '',
    incident_date: '',
    bay_number: '',
    amount_mentioned: '',
    description: '',
    staff_description: '',
    was_directly_affected: false,
    reporter_contact: '',
    company_name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(null);
  const [error, setError]           = useState('');
  const [showContact, setShowContact] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.incident_type)       { setError('Please select what type of incident occurred.'); return; }
    if (!form.description.trim())  { setError('Please describe what happened.'); return; }

    setSubmitting(true);
    try {
      const res = await integrityApi.submit(form);
      setSubmitted(res);
    } catch (err) {
      setError(err?.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Report Received</h1>
          <p className="text-gray-600 text-sm">
            Thank you for speaking up. Your report has been securely submitted to senior management
            and will be treated with the utmost confidentiality.
          </p>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Your Reference Number</p>
            <p className="text-2xl font-mono font-bold text-red-700">{submitted.ref}</p>
          </div>
          <div className="text-xs text-gray-400 space-y-1 text-left bg-gray-50 rounded-xl p-4">
            <p>• Your identity has <strong>not</strong> been recorded</p>
            <p>• This report goes directly to senior management</p>
            <p>• Keep your reference number if you wish to follow up</p>
          </div>
          <button
            onClick={() => { setSubmitted(null); setForm({ incident_type:'', incident_date:'', bay_number:'', amount_mentioned:'', description:'', staff_description:'', was_directly_affected: false, reporter_contact:'', company_name:'' }); }}
            className="w-full mt-2 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <ShieldAlert size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Integrity Concern Report</h1>
          <p className="text-gray-500 mt-1 text-sm max-w-md mx-auto">
            Report corruption, bribery, or solicitation by port staff. All reports are completely anonymous and go directly to senior management.
          </p>
        </div>

        {/* Confidentiality banner */}
        <div className="flex items-start gap-3 bg-white border border-green-200 rounded-2xl px-5 py-4 mb-6 shadow-sm">
          <Lock size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700">Your identity is protected</p>
            <p className="text-xs text-gray-500 mt-0.5">
              This form does not collect your name, device information, or IP address.
              Your submission cannot be traced back to you.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">

          {/* Incident type */}
          <Field label="What happened?" required>
            <div className="space-y-2">
              {INCIDENT_TYPES.map(t => (
                <label key={t.value}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    form.incident_type === t.value
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}>
                  <input
                    type="radio"
                    name="incident_type"
                    value={t.value}
                    checked={form.incident_type === t.value}
                    onChange={() => set('incident_type', t.value)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* Were you directly affected */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 bg-amber-50 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              checked={form.was_directly_affected}
              onChange={e => set('was_directly_affected', e.target.checked)}
              className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-amber-800">This happened directly to me</span>
              <p className="text-xs text-amber-600 mt-0.5">Check this if you personally experienced the solicitation or paid money</p>
            </div>
          </label>

          {/* Date and bay */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of incident" hint="Optional — when did this happen?">
              <input
                type="date"
                value={form.incident_date}
                onChange={e => set('incident_date', e.target.value)}
                max={new Date().toISOString().slice(0,10)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </Field>
            <Field label="Bay number" hint="Optional — which bay were you assigned or waiting for?">
              <input
                type="text"
                value={form.bay_number}
                onChange={e => set('bay_number', e.target.value)}
                placeholder="e.g. Bay 4, Bay 12"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </Field>
          </div>

          {/* Amount */}
          <Field label="Amount mentioned or paid" hint="Optional — you do not need to be exact">
            <input
              type="text"
              value={form.amount_mentioned}
              onChange={e => set('amount_mentioned', e.target.value)}
              placeholder={`e.g. "GHS 200", "USD 50", "I don't know the exact amount"`}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </Field>

          {/* Description */}
          <Field label="Describe what happened" required hint="Be as detailed as you can — time, location, what was said, what you observed.">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={6}
              placeholder="Describe the incident in your own words. You do not need to name anyone — describe what happened, where, and what was said or done."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{form.description.length} characters</p>
          </Field>

          {/* Staff description */}
          <Field label="Description of the staff member (optional)" hint="Do NOT include their name. Describe their appearance, role, uniform, or location at the port.">
            <textarea
              value={form.staff_description}
              onChange={e => set('staff_description', e.target.value)}
              rows={3}
              placeholder='e.g. "Male, wearing a yellow vest, working at the scanner booth near Gate 2", "Female supervisor at the bay allocation desk"'
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </Field>

          {/* Company (optional) */}
          <Field label="Your company / organisation (optional)">
            <input
              type="text"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="Company name (optional)"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </Field>

          {/* Optional contact toggle */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContact(c => !c)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                {showContact ? <EyeOff size={15} /> : <Eye size={15} />}
                {showContact ? 'Hide contact option' : 'Optionally provide contact for follow-up'}
              </span>
              <span className="text-xs text-gray-400">Completely optional</span>
            </button>
            {showContact && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Providing contact information means your report may no longer be fully anonymous.
                  Only do this if you are comfortable being contacted about your report.
                </p>
                <input
                  type="text"
                  value={form.reporter_contact}
                  onChange={e => set('reporter_contact', e.target.value)}
                  placeholder="Phone number or email (optional)"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={clsx(
              'w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors',
              submitting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
            )}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Submitting securely…' : 'Submit Confidential Report'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Reports are received directly by senior management and handled under strict confidentiality.
            You will not face any consequences for making a genuine report.
          </p>
        </form>
      </div>
    </div>
  );
}
