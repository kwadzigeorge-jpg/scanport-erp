import { useState, FormEvent } from 'react';
import type { Scanner } from '../../types';
import { createScanner, updateScanner } from '../../api/scanners';
import toast from 'react-hot-toast';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}

function Field({ label, value, onChange, required = false, type = 'text' }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
      />
    </div>
  );
}

interface Props {
  scanner: Scanner | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ScannerForm({ scanner, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    serialNumber: scanner?.serialNumber ?? '',
    acceleratorSerial: scanner?.acceleratorSerial ?? '',
    manufacturer: scanner?.manufacturer ?? 'Siemens',
    type: scanner?.type ?? 'Fixed Scanner',
    location: scanner?.location ?? '',
  });
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (scanner) {
        await updateScanner(scanner.id, form);
        toast.success('Scanner updated.');
      } else {
        await createScanner(form);
        toast.success('Scanner added.');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Scanner Serial Number" value={form.serialNumber} onChange={(v) => set('serialNumber', v)} required />
      <Field label="Accelerator Serial Number" value={form.acceleratorSerial} onChange={(v) => set('acceleratorSerial', v)} required />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
        <select
          value={form.manufacturer}
          onChange={(e) => set('manufacturer', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option>Siemens</option>
          <option>GE</option>
          <option>Smiths Detection</option>
          <option>Nuctech</option>
          <option>Leidos</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scanner Type</label>
        <select
          value={form.type}
          onChange={(e) => set('type', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <option>Fixed Scanner</option>
          <option>Mobile Scanner</option>
          <option>Drive-Through Scanner</option>
        </select>
      </div>
      <Field label="Location (optional)" value={form.location} onChange={(v) => set('location', v)} />

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          {loading ? 'Saving...' : scanner ? 'Update Scanner' : 'Add Scanner'}
        </button>
      </div>
    </form>
  );
}
