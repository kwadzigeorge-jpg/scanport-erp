import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { statementApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import { FileText, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const TYPE_LABELS = {
  complainant: 'Complainant',
  respondent:  'Respondent',
  witness:     'Witness',
  other:       'Other Party',
};

function fmtDate(v) {
  if (!v) return null;
  try { return format(parseISO(v.slice(0, 10)), 'dd MMMM yyyy'); } catch { return v; }
}

export default function StatementPage() {
  const { token } = useParams();
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  const { data, isLoading, isError } = useQuery(
    ['statement-token', token],
    () => statementApi.getByToken(token),
    { retry: false }
  );

  const submitMut = useMutation(() => statementApi.submitByToken(token, { statement_text: text }), {
    onSuccess: () => setDone(true),
  });

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Invalid token ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-sm text-gray-500">This statement link is invalid or has expired. Please contact HR.</p>
        </div>
      </div>
    );
  }

  const s = data;
  const isOverdue = s.due_date && new Date(s.due_date) < new Date() && !s.is_submitted;

  // ── Already submitted ────────────────────────────────────────────────────────
  if (s.is_submitted || done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Statement Submitted</h2>
          <p className="text-sm text-gray-500 mb-6">
            Thank you, <strong>{s.staff_name}</strong>. Your statement for case{' '}
            <strong>{s.grievance_ref}</strong> has been recorded successfully.
          </p>
          {(done ? text : s.statement_text) && (
            <div className="text-left bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Statement</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {done ? text : s.statement_text}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-6">You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Statement form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-xl">
            <FileText size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">ScanPort ERP</p>
            <h1 className="text-xl font-bold text-gray-900">Grievance Statement</h1>
          </div>
        </div>

        {/* Case info card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              {s.grievance_ref}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 capitalize">
              {TYPE_LABELS[s.statement_type] || s.statement_type}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Requested from</p>
              <p className="font-semibold text-gray-800">{s.staff_name}</p>
              {s.staff_designation && <p className="text-gray-500 text-xs">{s.staff_designation}</p>}
              {s.department && <p className="text-gray-500 text-xs">{s.department}</p>}
            </div>
            {s.due_date && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Due by</p>
                <p className={`font-semibold text-sm flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                  {isOverdue && <Clock size={13} />}
                  {fmtDate(s.due_date)}
                  {isOverdue && <span className="text-xs font-normal ml-1">(overdue)</span>}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <p className="font-semibold mb-1">Instructions</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700 text-xs leading-relaxed">
            <li>Write your statement in your own words, clearly and factually.</li>
            <li>Include dates, times, and names where relevant.</li>
            <li>Once submitted, your statement cannot be edited.</li>
            <li>Your statement will be reviewed by the HR/grievance team only.</li>
          </ul>
        </div>

        {/* Statement form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Your Statement <span className="text-red-500">*</span>
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={12}
            placeholder="Write your full statement here…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">{text.length} characters</p>
            <button
              onClick={() => submitMut.mutate()}
              disabled={!text.trim() || submitMut.isLoading}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitMut.isLoading ? 'Submitting…' : 'Submit Statement'}
            </button>
          </div>
          {submitMut.isError && (
            <p className="text-xs text-red-600 mt-2">
              {submitMut.error?.response?.data?.error || 'Submission failed. Please try again.'}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          This is a confidential grievance process. For assistance contact HR.
        </p>
      </div>
    </div>
  );
}
