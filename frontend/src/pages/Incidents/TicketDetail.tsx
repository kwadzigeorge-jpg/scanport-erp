import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, PaperClipIcon, ChatBubbleLeftIcon,
  ClockIcon, ArrowUpCircleIcon, CheckCircleIcon,
  ExclamationTriangleIcon, XCircleIcon, PencilSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import { getTicket, updateTicket, addComment, uploadAttachment } from '../../api/incidents';
import type { Ticket, TicketActivity, TicketStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const SEVERITY_COLORS = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  MAJOR:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  MINOR:    'bg-green-100 text-green-700 border-green-300',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN:        'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  ESCALATED:   'bg-red-100 text-red-800',
  RESOLVED:    'bg-green-100 text-green-800',
  CLOSED:      'bg-gray-100 text-gray-600',
};

type Transition = { to: TicketStatus; label: string; color: string };

const TRANSITIONS: Record<TicketStatus, Transition[]> = {
  OPEN:        [{ to: 'IN_PROGRESS', label: 'Start Working',  color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
                { to: 'ESCALATED',   label: 'Escalate',       color: 'bg-orange-500 hover:bg-orange-600 text-white' },
                { to: 'CLOSED',      label: 'Close (no fix)', color: 'bg-gray-500 hover:bg-gray-600 text-white' }],
  IN_PROGRESS: [{ to: 'RESOLVED',    label: 'Mark Resolved',  color: 'bg-green-600 hover:bg-green-700 text-white' },
                { to: 'ESCALATED',   label: 'Escalate',       color: 'bg-orange-500 hover:bg-orange-600 text-white' }],
  ESCALATED:   [{ to: 'IN_PROGRESS', label: 'Resume Work',    color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
                { to: 'RESOLVED',    label: 'Mark Resolved',  color: 'bg-green-600 hover:bg-green-700 text-white' }],
  RESOLVED:    [{ to: 'CLOSED',      label: 'Close Ticket',   color: 'bg-gray-700 hover:bg-gray-800 text-white' },
                { to: 'IN_PROGRESS', label: 'Reopen',         color: 'bg-yellow-500 hover:bg-yellow-600 text-white' }],
  CLOSED:      [],
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<TicketStatus | null>(null);
  const [showEditAssign, setShowEditAssign] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const t = await getTicket(id);
      setTicket(t);
      setAssignedTo(t.assignedTo || '');
    } catch {
      toast.error('Ticket not found.');
      navigate('/incidents');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleTransition(to: TicketStatus) {
    if (!ticket) return;
    if (to === 'RESOLVED' && !resolutionNotes.trim()) {
      toast.error('Resolution notes are required to resolve a ticket.');
      return;
    }
    setSubmitting(true);
    try {
      await updateTicket(ticket.id, {
        status:          to,
        resolutionNotes: resolutionNotes || undefined,
      });
      toast.success(`Ticket ${to === 'RESOLVED' ? 'resolved' : 'updated'} successfully.`);
      setActiveModal(null);
      setResolutionNotes('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !ticket) return;
    setSubmitting(true);
    try {
      await addComment(ticket.id, comment);
      setComment('');
      load();
    } catch {
      toast.error('Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEscalate() {
    if (!ticket) return;
    const nextLevel = Math.min(ticket.escalationLevel + 1, 3);
    setSubmitting(true);
    try {
      await updateTicket(ticket.id, {
        status:          'ESCALATED',
        escalationLevel: nextLevel,
        notes:           `Manually escalated to Level ${nextLevel}`,
      });
      toast.success(`Escalated to Level ${nextLevel}.`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Escalation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignSave() {
    if (!ticket) return;
    try {
      await updateTicket(ticket.id, { assignedTo, notes: `Assigned to ${assignedTo || 'Unassigned'}` });
      setShowEditAssign(false);
      load();
    } catch {
      toast.error('Failed to update assignment.');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ticket) return;
    try {
      await uploadAttachment(ticket.id, file);
      toast.success('Attachment uploaded.');
      load();
    } catch {
      toast.error('Upload failed.');
    }
    e.target.value = '';
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand border-t-transparent" />
    </div>
  );

  if (!ticket) return null;

  const sla = ticket.sla;
  const isActive = !['RESOLVED', 'CLOSED'].includes(ticket.status);
  const slaBreached = ticket.slaBreached || (sla?.resolutionBreached && isActive);
  const transitions = TRANSITIONS[ticket.status] || [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate('/incidents')}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Back to Incidents
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-lg font-bold text-brand">{ticket.ticketNumber}</span>
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${SEVERITY_COLORS[ticket.severity]}`}>
              {ticket.severity}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[ticket.status]}`}>
              {ticket.status.replace('_', ' ')}
            </span>
            {ticket.escalationLevel > 1 && (
              <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
                Escalation L{ticket.escalationLevel}
              </span>
            )}
            {slaBreached && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600 text-white text-xs font-bold">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> SLA BREACHED
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-800 mt-2 leading-snug">{ticket.title}</h1>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0">
          <ArrowPathIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Description</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </section>

          {/* Resolution Notes (if resolved/closed) */}
          {ticket.resolutionNotes && (
            <section className="bg-green-50 rounded-2xl border border-green-200 shadow-sm p-5">
              <h2 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5" /> Resolution Notes
              </h2>
              <p className="text-green-900 text-sm leading-relaxed">{ticket.resolutionNotes}</p>
            </section>
          )}

          {/* SLA Timeline */}
          {sla && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-brand" /> Timeline & SLA
              </h2>
              <div className="space-y-3 text-sm">
                <TimelineRow label="Reported" time={ticket.startTime} color="blue" />
                {ticket.firstResponseAt && (
                  <TimelineRow
                    label={`First Response ${sla.responseBreached ? '(Late)' : '(On time)'}`}
                    time={ticket.firstResponseAt}
                    color={sla.responseBreached ? 'red' : 'green'}
                    sub={`${differenceInMinutes(new Date(ticket.firstResponseAt), new Date(ticket.startTime))}m after report`}
                  />
                )}
                {!ticket.firstResponseAt && isActive && (
                  <TimelineRow
                    label={`Response Deadline ${sla.responseBreached ? '(OVERDUE)' : ''}`}
                    time={sla.responseDeadline}
                    color={sla.responseBreached ? 'red' : 'gray'}
                    isDead
                  />
                )}
                {ticket.resolvedAt && (
                  <TimelineRow
                    label={`Resolved ${slaBreached ? '(Late)' : '(On time)'}`}
                    time={ticket.resolvedAt}
                    color={slaBreached ? 'red' : 'green'}
                    sub={ticket.downtimeMinutes != null ? `Downtime: ${ticket.downtimeMinutes} minutes` : undefined}
                  />
                )}
                {!ticket.resolvedAt && isActive && (
                  <TimelineRow
                    label={`Resolution Deadline ${sla.resolutionBreached ? '(OVERDUE)' : `– ${sla.minutesRemaining}m remaining`}`}
                    time={sla.resolutionDeadline}
                    color={sla.resolutionBreached ? 'red' : 'orange'}
                    isDead
                  />
                )}
                {ticket.closedAt && (
                  <TimelineRow label="Closed" time={ticket.closedAt} color="gray" />
                )}
              </div>
            </section>
          )}

          {/* Activity Feed */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <ChatBubbleLeftIcon className="w-5 h-5 text-brand" />
              Activity ({ticket.activities?.length || 0})
            </h2>
            <div className="space-y-3 mb-5 max-h-72 overflow-y-auto">
              {ticket.activities?.map((act) => (
                <ActivityItem key={act.id} activity={act} />
              ))}
              {!ticket.activities?.length && (
                <p className="text-gray-400 text-sm">No activity yet.</p>
              )}
            </div>

            {/* Add comment */}
            {ticket.status !== 'CLOSED' && (
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand outline-none"
                />
                <button
                  type="submit"
                  disabled={!comment.trim() || submitting}
                  className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition"
                >
                  Post
                </button>
              </form>
            )}
          </section>

          {/* Attachments */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <PaperClipIcon className="w-5 h-5 text-brand" />
                Attachments ({ticket.attachments?.length || 0})
              </h2>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs text-brand hover:underline font-medium"
              >
                + Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
              />
            </div>
            {ticket.attachments?.length ? (
              <div className="space-y-2">
                {ticket.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-sm"
                  >
                    <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 truncate">{att.fileName}</span>
                    <span className="text-gray-400 text-xs ml-auto shrink-0">
                      {format(new Date(att.createdAt), 'dd/MM/yy HH:mm')}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No attachments.</p>
            )}
          </section>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          {/* Actions */}
          {transitions.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Actions</h2>
              <div className="space-y-2">
                {transitions.map((tr) => (
                  <button
                    key={tr.to}
                    onClick={() => {
                      if (tr.to === 'RESOLVED') {
                        setActiveModal(tr.to);
                      } else {
                        handleTransition(tr.to);
                      }
                    }}
                    disabled={submitting}
                    className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition ${tr.color} disabled:opacity-50`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Ticket Details */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Ticket Details</h2>
            <dl className="space-y-3 text-sm">
              <DetailRow label="Location"       value={ticket.location?.name} />
              <DetailRow label="Equipment Type" value={ticket.equipmentType} />
              <DetailRow label="Issue Type"     value={ticket.issueType} />
              <DetailRow label="Reported By"    value={ticket.reportedBy?.name} />
              <DetailRow label="Reported At"    value={format(new Date(ticket.startTime), 'dd MMM yyyy, HH:mm')} />
              <div>
                <dt className="text-gray-500 mb-1">Assigned To</dt>
                {showEditAssign ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="Team/person..."
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-brand outline-none"
                    />
                    <button onClick={handleAssignSave} className="text-xs text-green-600 font-medium px-2">Save</button>
                    <button onClick={() => setShowEditAssign(false)} className="text-xs text-gray-400">✕</button>
                  </div>
                ) : (
                  <dd className="flex items-center gap-1 font-medium text-gray-800">
                    {ticket.assignedTo || <span className="text-gray-400">Unassigned</span>}
                    <button onClick={() => setShowEditAssign(true)} className="ml-1 text-gray-400 hover:text-brand">
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                    </button>
                  </dd>
                )}
              </div>
              {ticket.downtimeMinutes != null && (
                <DetailRow label="Total Downtime" value={`${ticket.downtimeMinutes} minutes`} />
              )}
              {isActive && sla && (
                <div>
                  <dt className="text-gray-500 mb-1">SLA Status</dt>
                  <dd className={slaBreached ? 'text-red-600 font-bold' : 'text-green-700 font-medium'}>
                    {slaBreached ? `Breached (${sla.slaHours}h limit)` : `${sla.minutesRemaining}m remaining`}
                  </dd>
                </div>
              )}
              <DetailRow label="Escalation Level" value={`Level ${ticket.escalationLevel}`} />
              <DetailRow label="Last Updated" value={formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })} />
            </dl>
          </section>
        </div>
      </div>

      {/* Resolution Modal */}
      {activeModal === 'RESOLVED' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Resolve Ticket</h3>
            <p className="text-sm text-gray-500 mb-4">Provide resolution details before closing.</p>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="What was the root cause? What was done to fix it? Any follow-up required?"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand outline-none resize-none"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setActiveModal(null); setResolutionNotes(''); }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransition('RESOLVED')}
                disabled={!resolutionNotes.trim() || submitting}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40"
              >
                {submitting ? 'Resolving…' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ label, time, color, sub, isDead }: {
  label: string; time: string; color: string; sub?: string; isDead?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500',
    orange: 'bg-orange-400', gray: 'bg-gray-300',
  };
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3 h-3 rounded-full mt-1 ${colorMap[color] || 'bg-gray-300'} ${isDead ? 'opacity-50' : ''}`} />
      </div>
      <div>
        <span className={`font-medium ${isDead ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
        <div className="text-xs text-gray-400">
          {format(new Date(time), 'dd MMM yyyy, HH:mm')}
          {!isDead && ` · ${formatDistanceToNow(new Date(time), { addSuffix: true })}`}
        </div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: TicketActivity }) {
  const isSystem = activity.userId === 'system';
  const isStatusChange = activity.fromStatus && activity.toStatus;

  return (
    <div className={`flex gap-3 ${isSystem ? 'opacity-70' : ''}`}>
      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5 ${isSystem ? 'bg-gray-400' : 'bg-brand'}">
        {isSystem ? '⚙' : activity.userName[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-gray-800 text-xs">{activity.userName}</span>
          {isStatusChange && (
            <span className="text-xs text-gray-500">
              {activity.fromStatus?.replace('_', ' ')} → <strong>{activity.toStatus?.replace('_', ' ')}</strong>
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </span>
        </div>
        {!isStatusChange && (
          <p className="text-xs text-gray-600 mt-0.5 font-medium">{activity.action}</p>
        )}
        {activity.notes && (
          <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{activity.notes}</p>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800 mt-0.5">{value || '—'}</dd>
    </div>
  );
}
