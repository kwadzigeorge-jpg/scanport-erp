import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArchiveBoxIcon, ScissorsIcon, TruckIcon,
  IdentificationIcon, PhoneIcon, BuildingOfficeIcon,
  ClipboardDocumentListIcon, ClockIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { createAgentRequest, CreateAgentRequestPayload } from '../../api/agentRequests';
import { useAuth } from '../../contexts/AuthContext';

type RequestType = 'SEAL_CUTTING' | 'GANG_UNSTUFFING' | '';

const GANGS = ['Gang 1', 'Gang 2', 'Gang 3', 'Gang 4', 'Gang 5', 'Gang 6', 'Gang 7', 'Gang 8'];

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none';
const selectCls =
  'w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8';

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDownIcon className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

export default function AgentRequestForm() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    requestType:     '' as RequestType,
    containerNumber: '',
    containerSize:   '',
    sealNumber:      '',
    bayZone:         '',
    bayNumber:       '',
    gangAssigned:    '',
    agencyName:      '',
    agentName:       '',
    agentPhone:      '',
    itemDescription: '',
    completionTime:  '',
    notes:           '',
  });

  function set(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const isSeal      = form.requestType === 'SEAL_CUTTING';
  const isUnstuffing = form.requestType === 'GANG_UNSTUFFING';

  const baseValid = form.requestType && form.containerNumber.trim() && form.containerSize;
  const sealValid = isSeal && !!form.sealNumber.trim();
  const unstuffingValid = isUnstuffing &&
    !!form.sealNumber.trim() && !!form.bayZone && !!form.bayNumber.trim() &&
    !!form.gangAssigned && !!form.agencyName.trim() && !!form.agentName.trim() &&
    !!form.agentPhone.trim() && !!form.itemDescription.trim() && !!form.completionTime;

  const isValid = baseValid && (sealValid || unstuffingValid);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      const payload: CreateAgentRequestPayload = {
        requestType:     form.requestType,
        containerNumber: form.containerNumber.trim().toUpperCase(),
        containerSize:   form.containerSize,
        sealNumber:      form.sealNumber.trim(),
      };
      if (isUnstuffing) {
        payload.bayZone         = form.bayZone;
        payload.bayNumber       = form.bayNumber.trim();
        payload.gangAssigned    = form.gangAssigned;
        payload.agencyName      = form.agencyName.trim();
        payload.agentName       = form.agentName.trim();
        payload.agentPhone      = form.agentPhone.trim();
        payload.itemDescription = form.itemDescription.trim();
        payload.completionTime  = new Date(form.completionTime).toISOString();
      }
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const req = await createAgentRequest(payload);
      toast.success(`Request ${req.requestNumber} submitted!`);
      navigate(`/agent-requests/${req.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/agent-requests')} className="text-gray-400 hover:text-gray-600 text-sm mb-1">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-800">New Agent Request</h1>
        <p className="text-gray-500 text-sm mt-1">
          Submitted by <strong>{user?.name}</strong> · {new Date().toLocaleString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Request Type ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardDocumentListIcon className="w-5 h-5 text-brand" />
            <h2 className="font-semibold text-gray-700">Request Type</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                value: 'SEAL_CUTTING' as RequestType,
                label: 'Cutting of Seal',
                icon:  ScissorsIcon,
                desc:  'Request to cut and remove a container seal',
              },
              {
                value: 'GANG_UNSTUFFING' as RequestType,
                label: 'Gang for Unstuffing',
                icon:  TruckIcon,
                desc:  'Request a gang assignment for container unstuffing',
              },
            ].map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('requestType', value)}
                className={`relative p-4 rounded-xl border-2 text-left transition ${
                  form.requestType === value
                    ? 'border-brand bg-blue-50 text-brand'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5" />
                  <span className="font-bold text-sm">{label}</span>
                </div>
                <p className="text-xs opacity-70">{desc}</p>
                {form.requestType === value && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Container Info ── */}
        {form.requestType && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ArchiveBoxIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Container Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label text="Container Number" required />
                <input
                  type="text"
                  value={form.containerNumber}
                  onChange={(e) => set('containerNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. MSCU1234567"
                  className={inputCls}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div>
                <Label text="Container Size" required />
                <SelectWrapper>
                  <select
                    value={form.containerSize}
                    onChange={(e) => set('containerSize', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select size…</option>
                    <option value="20FT">20 ft</option>
                    <option value="40FT">40 ft</option>
                    <option value="45FT">45 ft</option>
                  </select>
                </SelectWrapper>
              </div>
              <div className={isUnstuffing ? '' : 'sm:col-span-2'}>
                <Label text="Seal Number" required />
                <input
                  type="text"
                  value={form.sealNumber}
                  onChange={(e) => set('sealNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. SL-001234"
                  className={inputCls}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              {/* Bay fields — only for unstuffing */}
              {isUnstuffing && (
                <>
                  <div>
                    <Label text="Bay Zone" required />
                    <SelectWrapper>
                      <select
                        value={form.bayZone}
                        onChange={(e) => set('bayZone', e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Select zone…</option>
                        <option value="1-50">Bays 1 – 50</option>
                        <option value="51-80">Bays 51 – 80</option>
                      </select>
                    </SelectWrapper>
                  </div>
                  <div>
                    <Label text="Bay Number" required />
                    <input
                      type="text"
                      value={form.bayNumber}
                      onChange={(e) => set('bayNumber', e.target.value)}
                      placeholder={form.bayZone === '1-50' ? '1 – 50' : form.bayZone === '51-80' ? '51 – 80' : 'Bay no.'}
                      className={inputCls}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Gang & Agency Info — Unstuffing only ── */}
        {isUnstuffing && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TruckIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Gang & Agency Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label text="Gang Assigned" required />
                <SelectWrapper>
                  <select
                    value={form.gangAssigned}
                    onChange={(e) => set('gangAssigned', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select gang…</option>
                    {GANGS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>
              <div>
                <Label text="Agency Name" required />
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.agencyName}
                    onChange={(e) => set('agencyName', e.target.value)}
                    placeholder="Shipping agency name"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <Label text="Agent Name" required />
                <div className="relative">
                  <IdentificationIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.agentName}
                    onChange={(e) => set('agentName', e.target.value)}
                    placeholder="Full name of agent"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label text="Agent Phone Number" required />
                <div className="relative">
                  <PhoneIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={form.agentPhone}
                    onChange={(e) => set('agentPhone', e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Unstuffing Details ── */}
        {isUnstuffing && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-brand" />
              <h2 className="font-semibold text-gray-700">Unstuffing Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label text="Description of Items to be Unstuffed" required />
                <textarea
                  rows={3}
                  value={form.itemDescription}
                  onChange={(e) => set('itemDescription', e.target.value)}
                  placeholder="Describe the cargo / goods being unstuffed…"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <Label text="Expected Time of Unstuffing Completion" required />
                <input
                  type="datetime-local"
                  value={form.completionTime}
                  onChange={(e) => set('completionTime', e.target.value)}
                  className={inputCls}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Notes (optional) ── */}
        {form.requestType && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <Label text="Additional Notes (optional)" />
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any additional information…"
              className={`${inputCls} resize-none`}
            />
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/agent-requests')}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition ${
              isValid && !submitting
                ? 'bg-brand hover:opacity-90 text-white shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Submitting…
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
