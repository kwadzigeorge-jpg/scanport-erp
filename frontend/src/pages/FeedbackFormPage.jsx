import React, { useState } from 'react';
import { feedbackApi } from '../services/api';
import clsx from 'clsx';
import { CheckCircle2, Loader2, MessageSquare, Star } from 'lucide-react';

const SUBMITTER_TYPES = [
  { value: 'shipping_agent',  label: 'Shipping Agent' },
  { value: 'importer',        label: 'Importer' },
  { value: 'exporter',        label: 'Exporter' },
  { value: 'truck_operator',  label: 'Truck Operator' },
  { value: 'customs_broker',  label: 'Customs Broker' },
  { value: 'port_authority',  label: 'Port Authority' },
  { value: 'other',           label: 'Other' },
];

const CATEGORIES = [
  { value: 'wait_time',      label: 'Wait / Turnaround Time' },
  { value: 'staff_conduct',  label: 'Staff Conduct' },
  { value: 'facility',       label: 'Facility & Infrastructure' },
  { value: 'documentation',  label: 'Documentation & Processing' },
  { value: 'communication',  label: 'Communication' },
  { value: 'billing',        label: 'Billing & Charges' },
  { value: 'safety',         label: 'Health & Safety' },
  { value: 'other',          label: 'Other' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low — informational' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High — affects operations' },
  { value: 'urgent', label: 'Urgent — needs immediate attention' },
];

function Field({ label, required, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const RATING_LABELS = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
const RATING_COLORS = ['', 'text-red-500', 'text-orange-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              size={36}
              className={clsx('transition-colors', (hovered || value) >= n
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
              )}
            />
          </button>
        ))}
      </div>
      <p className={clsx('text-sm font-semibold h-5', RATING_COLORS[(hovered || value)] || 'text-transparent')}>
        {RATING_LABELS[(hovered || value)] || '—'}
      </p>
    </div>
  );
}

export default function FeedbackFormPage() {
  const [form, setForm] = useState({
    is_anonymous: false,
    submitter_name: '',
    submitter_email: '',
    submitter_phone: '',
    submitter_type: '',
    company_name: '',
    category: '',
    priority: 'normal',
    subject: '',
    description: '',
    date_occurred: '',
    overall_rating: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.is_anonymous && !form.submitter_name.trim()) {
      setError('Please enter your name, or choose to submit anonymously.');
      return;
    }
    if (!form.submitter_type) { setError('Please select your stakeholder type.'); return; }
    if (!form.category)       { setError('Please select a category.'); return; }
    if (!form.subject.trim()) { setError('Subject is required.'); return; }
    if (!form.description.trim()) { setError('Description is required.'); return; }

    setSubmitting(true);
    try {
      const res = await feedbackApi.submit(form);
      setSubmitted(res);
    } catch (err) {
      setError(err?.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Feedback Received</h1>
          <p className="text-gray-600">
            Thank you. Your submission has been logged and will be reviewed by our team.
          </p>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Reference Number</p>
            <p className="text-2xl font-mono font-bold text-blue-700">{submitted.ref}</p>
          </div>
          <p className="text-xs text-gray-400">
            Please keep this reference number for follow-up.
          </p>
          <button
            onClick={() => { setSubmitted(null); setForm({ is_anonymous: false, submitter_name: '', submitter_email: '', submitter_phone: '', submitter_type: '', company_name: '', category: '', priority: 'normal', subject: '', description: '', date_occurred: '', overall_rating: 0 }); }}
            className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare size={24} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Service Feedback</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Help us improve. Share your experience with our port services.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">

          {/* Overall satisfaction rating — most prominent */}
          <div className="text-center space-y-1 py-2">
            <p className="text-sm font-semibold text-gray-700">Overall satisfaction with our service</p>
            <p className="text-xs text-gray-400 mb-3">Tap a star to rate (optional)</p>
            <StarRating value={form.overall_rating} onChange={v => set('overall_rating', v)} />
          </div>

          <hr className="border-gray-100" />

          {/* Anonymous toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_anonymous}
              onChange={e => set('is_anonymous', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Submit anonymously (your identity will not be recorded)</span>
          </label>

          {/* Identity */}
          {!form.is_anonymous && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input
                  type="text"
                  value={form.submitter_name}
                  onChange={e => set('submitter_name', e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Email" hint="Optional — for follow-up">
                <input
                  type="email"
                  value={form.submitter_email}
                  onChange={e => set('submitter_email', e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Phone" hint="Optional">
                <input
                  type="tel"
                  value={form.submitter_phone}
                  onChange={e => set('submitter_phone', e.target.value)}
                  placeholder="+233 ..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Company / Organisation">
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="Company name"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
            </div>
          )}

          {/* Stakeholder type */}
          <Field label="I am a" required>
            <select
              value={form.submitter_type}
              onChange={e => set('submitter_type', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your stakeholder type…</option>
              {SUBMITTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category" required>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Date occurred */}
          <Field label="Date of Incident" hint="Optional — when did this happen?">
            <input
              type="date"
              value={form.date_occurred}
              onChange={e => set('date_occurred', e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          {/* Subject */}
          <Field label="Subject" required>
            <input
              type="text"
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="Brief summary of your feedback"
              maxLength={300}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          {/* Description */}
          <Field label="Description" required hint="Please be as detailed as possible.">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={5}
              placeholder="Describe your experience in detail…"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </Field>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={clsx(
              'w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors',
              submitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Your feedback is handled confidentially and used solely to improve our services.
          </p>
        </form>
      </div>
    </div>
  );
}
