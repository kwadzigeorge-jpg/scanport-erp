import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArchiveBoxIcon, ScissorsIcon, TruckIcon,
  IdentificationIcon, PhoneIcon, BuildingOfficeIcon,
  ClockIcon, MapPinIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getAgentRequest, updateAgentRequest } from '../../api/agentRequests';
import type { AgentRequest } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED:    'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-200',
  COMPLETED:   'bg-green-100 text-green-800 border-green-200',
  REJECTED:    'bg-red-100 text-red-800 border-red-200',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ['APPROVED', 'REJECTED'],
  APPROVED:    ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED:   [],
  REJECTED:    [],
};

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

export default function AgentRequestDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const { isAdmin }  = useAuth();

  const [request,   setRequest]   = useState<AgentRequest | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [updating,  setUpdating]  = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    if (!id) return;
    getAgentRequest(id)
      .then(setRequest)
      .catch(() => toast.error('Request not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    if (!id || !newStatus) return;
    setUpdating(true);
    try {
      const updated = await updateAgentRequest(id, { status: newStatus });
      setRequest(updated);
      setNewStatus('');
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Request not found.</p>
        <button onClick={() => navigate('/agent-requests')} className="mt-3 text-brand text-sm underline">
          ← Back to requests
        </button>
      </div>
    );
  }

  const isSeal      = request.requestType === 'SEAL_CUTTING';
  const isUnstuffing = request.requestType === 'GANG_UNSTUFFING';
  const transitions  = STATUS_TRANSITIONS[request.status] || [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/agent-requests')} className="text-gray-400 hover:text-gray-600 text-sm">
        ← Back to Agent Requests
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isSeal
                ? <ScissorsIcon className="w-5 h-5 text-orange-500" />
                : <TruckIcon className="w-5 h-5 text-cyan-600" />
              }
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {isSeal ? 'Seal Cutting Request' : 'Gang for Unstuffing Request'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 font-mono">{request.requestNumber}</h1>
            <p className="text-gray-400 text-xs mt-1">
              Submitted by <strong className="text-gray-600">{request.submittedBy?.name}</strong>
              {' · '}
              {format(new Date(request.createdAt), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border ${STATUS_STYLES[request.status]}`}>
            {request.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Container details */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArchiveBoxIcon className="w-5 h-5 text-brand" />
          <h2 className="font-semibold text-gray-700">Container Details</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <DetailRow label="Container Number" value={request.containerNumber} mono />
          <DetailRow label="Container Size"   value={request.containerSize.replace('FT', ' ft')} />
          <DetailRow label="Seal Number"      value={request.sealNumber} mono />
        </div>
      </div>

      {/* Bay & Gang details — unstuffing only */}
      {isUnstuffing && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPinIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Bay Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <DetailRow label="Bay Zone"   value={request.bayZone ? `Bays ${request.bayZone}` : null} />
              <DetailRow label="Bay Number" value={request.bayNumber} />
              <DetailRow label="Gang Assigned" value={request.gangAssigned} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BuildingOfficeIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Agency & Agent</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <DetailRow label="Agency Name" value={request.agencyName} />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agent Name</p>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <IdentificationIcon className="w-3.5 h-3.5 text-gray-400" />
                  {request.agentName}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agent Phone</p>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`tel:${request.agentPhone}`} className="text-brand hover:underline">
                    {request.agentPhone}
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Unstuffing Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Items Description</p>
                <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-lg p-3">
                  {request.itemDescription}
                </p>
              </div>
              {request.completionTime && (
                <DetailRow
                  label="Expected Completion Time"
                  value={format(new Date(request.completionTime), 'dd MMM yyyy, HH:mm')}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      {request.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-amber-900">{request.notes}</p>
        </div>
      )}

      {/* Status update — admin only */}
      {isAdmin && transitions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Update Status</h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8"
              >
                <option value="">Select new status…</option>
                {transitions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={handleStatusUpdate}
              disabled={!newStatus || updating}
              className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
            >
              {updating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : 'Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
