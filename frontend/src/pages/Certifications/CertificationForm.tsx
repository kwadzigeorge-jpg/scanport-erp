import { useState, FormEvent, useEffect } from 'react';
import type { Certification } from '../../types';
import { createCertification, updateCertification } from '../../api/certifications';
import { listScanners } from '../../api/scanners';
import { format, addYears, subMonths } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  cert?: Certification | null;
  scannerId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CertificationForm({ cert, scannerId, onSuccess, onCancel }: Props) {
  const [scanners, setScanners] = useState<{ id: string; serialNumber: string }[]>([]);
  const [form, setForm] = useState({
    scannerId:         scannerId ?? cert?.scannerId ?? '',
    inspectionDate:    cert ? format(new Date(cert.inspectionDate), 'yyyy-MM-dd') : '',
    expiryDate:        cert ? format(new Date(cert.expiryDate), 'yyyy-MM-dd') : '',
    certificateStatus: cert?.certificateStatus ?? 'ISSUED',
  });
  const [expiryOverride, setExpiryOverride] = useState(!!cert); // when editing, show existing expiry
  const [loading, setLoading] = useState(false);

  useEffect(() => { listScanners().then(setScanners); }, []);

  // Auto-calculate expiry = inspection + 1 year whenever inspection changes (unless overridden)
  function handleInspectionChange(val: string) {
    setForm((f) => {
      const autoExpiry = val && !expiryOverride
        ? format(addYears(new Date(val), 1), 'yyyy-MM-dd')
        : f.expiryDate;
      return { ...f, inspectionDate: val, expiryDate: autoExpiry };
    });
  }

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  const previewExpiry  = form.expiryDate ? format(new Date(form.expiryDate), 'dd MMM yyyy') : '—';
  const previewNotice  = form.expiryDate
    ? format(subMonths(new Date(form.expiryDate), 4), 'dd MMM yyyy')
    : '—';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.scannerId) return toast.error('Please select a scanner.');
    setLoading(true);
    try {
      if (cert) {
        await updateCertification(cert.id, form);
        toast.success('Certification updated.');
      } else {
        // Send inspectionDate only; backend auto-sets expiry = +1 year unless overridden
        await createCertification({
          scannerId:         form.scannerId,
          inspectionDate:    form.inspectionDate,
          expiryDate:        expiryOverride ? form.expiryDate : undefined,
          certificateStatus: form.certificateStatus,
        });
        toast.success('Certification added.');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Scanner selector (hidden when scannerId is pre-set) */}
      {!scannerId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scanner <span className="text-red-500">*</span>
          </label>
          <select
            value={form.scannerId}
            onChange={(e) => set('scannerId', e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
          >
            <option value="">Select scanner...</option>
            {scanners.map((s) => <option key={s.id} value={s.id}>{s.serialNumber}</option>)}
          </select>
        </div>
      )}

      {/* Inspection Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Inspection Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={form.inspectionDate}
          onChange={(e) => handleInspectionChange(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      {/* Expiry Date */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Expiry Date
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={expiryOverride}
              onChange={(e) => {
                setExpiryOverride(e.target.checked);
                // When unchecking, reset to auto-calculated value
                if (!e.target.checked && form.inspectionDate) {
                  set('expiryDate', format(addYears(new Date(form.inspectionDate), 1), 'yyyy-MM-dd'));
                }
              }}
              className="rounded"
            />
            Override auto-calculated date
          </label>
        </div>
        <input
          type="date"
          value={form.expiryDate}
          onChange={(e) => { setExpiryOverride(true); set('expiryDate', e.target.value); }}
          disabled={!expiryOverride && !form.inspectionDate}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      {/* Auto-calculated preview */}
      {form.inspectionDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-blue-600 font-medium">Expiry Date (1 year from inspection)</span>
            <span className="text-blue-800 font-bold">{previewExpiry}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-600 font-medium">NRA Notice Date (4 months before expiry)</span>
            <span className="text-blue-800 font-bold">{previewNotice}</span>
          </div>
          <p className="text-blue-400 text-xs pt-0.5">Both dates are calculated automatically. Check "Override" above to set a custom expiry.</p>
        </div>
      )}

      {/* Certificate Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Status</label>
        <select
          value={form.certificateStatus}
          onChange={(e) => set('certificateStatus', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option value="ISSUED">Issued</option>
          <option value="PENDING">Pending (Awaiting Certification)</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {loading ? 'Saving...' : cert ? 'Update' : 'Add Certification'}
        </button>
      </div>
    </form>
  );
}
