import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fleetApi } from '../services/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  Truck, Users, Fuel, Wrench, BarChart3, AlertTriangle,
  Plus, X, Pencil, CheckCircle, XCircle, Clock, RefreshCw,
  Shield, Calendar, Activity, TrendingUp, MapPin, Bell,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard',    label: 'Dashboard',    icon: BarChart3 },
  { key: 'vehicles',     label: 'Vehicles',     icon: Truck },
  { key: 'drivers',      label: 'Drivers',      icon: Users },
  { key: 'mileage',      label: 'Mileage Log',  icon: Activity },
  { key: 'fuel',         label: 'Fuel Log',     icon: Fuel },
  { key: 'maintenance',  label: 'Maintenance',  icon: Wrench },
];

const VEHICLE_STATUS = {
  active:             'bg-green-100 text-green-700',
  under_maintenance:  'bg-amber-100 text-amber-700',
  out_of_service:     'bg-red-100 text-red-600',
};
const DRIVER_STATUS = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  suspended: 'bg-red-100 text-red-600',
};
const MILEAGE_STATUS = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};
const MAINT_STATUS = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
};
const ALERT_ICON = {
  service_due:       { cls: 'text-amber-500', label: 'Service Due' },
  service_overdue:   { cls: 'text-red-500',   label: 'Service Overdue' },
  insurance_expiry:  { cls: 'text-red-500',   label: 'Insurance' },
  roadworthy_expiry: { cls: 'text-red-500',   label: 'Roadworthy' },
  license_expiry:    { cls: 'text-orange-500',label: 'License' },
  abnormal_fuel:     { cls: 'text-purple-500',label: 'Fuel Alert' },
  abnormal_mileage:  { cls: 'text-blue-500',  label: 'Mileage Alert' },
};
const FUEL_TYPES = ['diesel','petrol','electric','hybrid','lpg'];
const MAINT_TYPES = ['preventive','corrective','repair','inspection','parts_replacement'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const sel = inp + ' bg-white';
function fmtDate(v) { try { return v ? format(parseISO(v.slice(0,10)), 'dd MMM yyyy') : '—'; } catch { return v || '—'; } }
function fmtNum(v, dec=0) { return v != null ? parseFloat(v).toFixed(dec) : '—'; }

function Spinner() {
  return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
}
function EmptyState({ msg }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{msg}</div>;
}

function Badge({ map, value, label }) {
  return (
    <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', map[value] || 'bg-gray-100 text-gray-500')}>
      {label || value?.replace(/_/g,' ') || '—'}
    </span>
  );
}

function KPICard({ label, value, sub, icon: Icon, accent }) {
  const bg = { green:'bg-green-50 border-green-200', amber:'bg-amber-50 border-amber-200', red:'bg-red-50 border-red-200', blue:'bg-blue-50 border-blue-200' }[accent] || 'bg-white border-gray-200';
  const ic = { green:'bg-green-100 text-green-600', amber:'bg-amber-100 text-amber-600', red:'bg-red-100 text-red-600', blue:'bg-blue-100 text-blue-600' }[accent] || 'bg-blue-100 text-blue-600';
  const tx = { green:'text-green-700', amber:'text-amber-700', red:'text-red-700', blue:'text-blue-700' }[accent] || 'text-gray-900';
  return (
    <div className={clsx('rounded-xl border p-4 flex items-start gap-3', bg)}>
      {Icon && <div className={clsx('p-2 rounded-lg shrink-0', ic)}><Icon size={16}/></div>}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={clsx('text-2xl font-bold', tx)}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={clsx('bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col', wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Vehicle Modal ─────────────────────────────────────────────────────────────
function VehicleModal({ vehicle, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!vehicle;
  const [f, setF] = useState({
    registration_number: vehicle?.registration_number || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year_of_manufacture: vehicle?.year_of_manufacture || '',
    chassis_number: vehicle?.chassis_number || '',
    engine_number: vehicle?.engine_number || '',
    fuel_type: vehicle?.fuel_type || 'diesel',
    tank_capacity_litres: vehicle?.tank_capacity_litres || '',
    service_interval_km: vehicle?.service_interval_km || 5000,
    insurance_expiry: vehicle?.insurance_expiry?.slice(0,10) || '',
    roadworthy_expiry: vehicle?.roadworthy_expiry?.slice(0,10) || '',
    current_odometer_km: vehicle?.current_odometer_km || 0,
    notes: vehicle?.notes || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation(
    d => isEdit ? fleetApi.updateVehicle(vehicle.id, d) : fleetApi.createVehicle(d),
    {
      onSuccess: () => { toast.success(isEdit ? 'Vehicle updated.' : 'Vehicle registered.'); qc.invalidateQueries('fleet-vehicles'); onClose(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={isEdit ? 'Edit Vehicle' : 'Register Vehicle'} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Registration Number" required>
          <input className={inp} value={f.registration_number} onChange={e => set('registration_number', e.target.value.toUpperCase())} placeholder="GR-1234-20" />
        </Field>
        <Field label="Fuel Type" required>
          <select className={sel} value={f.fuel_type} onChange={e => set('fuel_type', e.target.value)}>
            {FUEL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Make" required>
          <input className={inp} value={f.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" />
        </Field>
        <Field label="Model" required>
          <input className={inp} value={f.model} onChange={e => set('model', e.target.value)} placeholder="Land Cruiser" />
        </Field>
        <Field label="Year of Manufacture">
          <input type="number" className={inp} value={f.year_of_manufacture} onChange={e => set('year_of_manufacture', e.target.value)} placeholder="2020" min="1990" max="2030" />
        </Field>
        <Field label="Current Odometer (km)">
          <input type="number" className={inp} value={f.current_odometer_km} onChange={e => set('current_odometer_km', e.target.value)} placeholder="0" min="0" />
        </Field>
        <Field label="Chassis Number">
          <input className={inp} value={f.chassis_number} onChange={e => set('chassis_number', e.target.value)} />
        </Field>
        <Field label="Engine Number">
          <input className={inp} value={f.engine_number} onChange={e => set('engine_number', e.target.value)} />
        </Field>
        <Field label="Tank Capacity (L)">
          <input type="number" className={inp} value={f.tank_capacity_litres} onChange={e => set('tank_capacity_litres', e.target.value)} placeholder="60" />
        </Field>
        <Field label="Service Interval (km)">
          <input type="number" className={inp} value={f.service_interval_km} onChange={e => set('service_interval_km', e.target.value)} placeholder="5000" />
        </Field>
        <Field label="Insurance Expiry">
          <input type="date" className={inp} value={f.insurance_expiry} onChange={e => set('insurance_expiry', e.target.value)} />
        </Field>
        <Field label="Roadworthy Expiry">
          <input type="date" className={inp} value={f.roadworthy_expiry} onChange={e => set('roadworthy_expiry', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Notes">
            <textarea className={inp} rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => mut.mutate(f)} disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
          {mut.isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Vehicle'}
        </button>
      </div>
    </Modal>
  );
}

// ── Driver Modal ──────────────────────────────────────────────────────────────
function DriverModal({ driver, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!driver;
  const [f, setF] = useState({
    full_name: driver?.full_name || '',
    employee_number: driver?.employee_number || '',
    phone: driver?.phone || '',
    license_number: driver?.license_number || '',
    license_class: driver?.license_class || '',
    license_expiry: driver?.license_expiry?.slice(0,10) || '',
    status: driver?.status || 'active',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation(
    d => isEdit ? fleetApi.updateDriver(driver.id, d) : fleetApi.createDriver(d),
    {
      onSuccess: () => { toast.success(isEdit ? 'Driver updated.' : 'Driver added.'); qc.invalidateQueries('fleet-drivers'); onClose(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={isEdit ? 'Edit Driver' : 'Add Driver'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Full Name" required>
          <input className={inp} value={f.full_name} onChange={e => set('full_name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee Number">
            <input className={inp} value={f.employee_number} onChange={e => set('employee_number', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inp} value={f.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
          <Field label="License Number" required>
            <input className={inp} value={f.license_number} onChange={e => set('license_number', e.target.value)} />
          </Field>
          <Field label="License Class">
            <input className={inp} value={f.license_class} onChange={e => set('license_class', e.target.value)} placeholder="B, C, D…" />
          </Field>
          <Field label="License Expiry" required>
            <input type="date" className={inp} value={f.license_expiry} onChange={e => set('license_expiry', e.target.value)} />
          </Field>
          {isEdit && (
            <Field label="Status">
              <select className={sel} value={f.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => mut.mutate(f)} disabled={mut.isLoading} className="btn-primary text-sm py-2 px-4">
          {mut.isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Driver'}
        </button>
      </div>
    </Modal>
  );
}

// ── Mileage Log Modal ─────────────────────────────────────────────────────────
function MileageModal({ onClose }) {
  const qc = useQueryClient();
  const { data: vehicles = [] } = useQuery('fleet-vehicles', () => fleetApi.listVehicles());
  const { data: drivers  = [] } = useQuery('fleet-drivers',  () => fleetApi.listDrivers());
  const [f, setF] = useState({
    vehicle_id: '', driver_id: '', trip_date: new Date().toISOString().slice(0,10),
    trip_start_time: '', trip_end_time: '',
    odometer_start: '', odometer_end: '',
    trip_purpose: '', origin: '', destination: '',
    fuel_added_litres: '', fuel_cost: '', remarks: '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const dist = f.odometer_start && f.odometer_end ? Math.max(0, parseFloat(f.odometer_end||0) - parseFloat(f.odometer_start||0)).toFixed(1) : null;

  const mut = useMutation(fleetApi.createMileage, {
    onSuccess: () => { toast.success('Trip logged.'); qc.invalidateQueries('fleet-mileage'); qc.invalidateQueries('fleet-dashboard'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <Modal title="Log Trip" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vehicle" required>
          <select className={sel} value={f.vehicle_id} onChange={e => set('vehicle_id', e.target.value)}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.make} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Driver" required>
          <select className={sel} value={f.driver_id} onChange={e => set('driver_id', e.target.value)}>
            <option value="">— Select driver —</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </Field>
        <Field label="Trip Date" required>
          <input type="date" className={inp} value={f.trip_date} onChange={e => set('trip_date', e.target.value)} />
        </Field>
        <Field label="Trip Purpose" required>
          <input className={inp} value={f.trip_purpose} onChange={e => set('trip_purpose', e.target.value)} placeholder="Official / Field work…" />
        </Field>
        <Field label="Start Time">
          <input type="time" className={inp} value={f.trip_start_time} onChange={e => set('trip_start_time', e.target.value)} />
        </Field>
        <Field label="End Time">
          <input type="time" className={inp} value={f.trip_end_time} onChange={e => set('trip_end_time', e.target.value)} />
        </Field>
        <Field label="Odometer Start (km)" required>
          <input type="number" className={inp} value={f.odometer_start} onChange={e => set('odometer_start', e.target.value)} />
        </Field>
        <Field label="Odometer End (km)" required>
          <input type="number" className={inp} value={f.odometer_end} onChange={e => set('odometer_end', e.target.value)} />
        </Field>
        {dist !== null && (
          <div className="col-span-2">
            <div className={clsx('rounded-lg px-3 py-2 text-sm font-medium', parseFloat(dist) > 500 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200')}>
              Distance: {dist} km {parseFloat(dist) > 500 && '⚠ Will be flagged for review'}
            </div>
          </div>
        )}
        <Field label="Origin">
          <input className={inp} value={f.origin} onChange={e => set('origin', e.target.value)} />
        </Field>
        <Field label="Destination">
          <input className={inp} value={f.destination} onChange={e => set('destination', e.target.value)} />
        </Field>
        <Field label="Fuel Added (L)">
          <input type="number" className={inp} value={f.fuel_added_litres} onChange={e => set('fuel_added_litres', e.target.value)} />
        </Field>
        <Field label="Fuel Cost (GHS)">
          <input type="number" className={inp} value={f.fuel_cost} onChange={e => set('fuel_cost', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Remarks">
            <textarea className={inp} rows={2} value={f.remarks} onChange={e => set('remarks', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => mut.mutate(f)} disabled={mut.isLoading || !f.vehicle_id || !f.driver_id} className="btn-primary text-sm py-2 px-4">
          {mut.isLoading ? 'Logging…' : 'Log Trip'}
        </button>
      </div>
    </Modal>
  );
}

// ── Fuel Log Modal ────────────────────────────────────────────────────────────
function FuelModal({ onClose }) {
  const qc = useQueryClient();
  const { data: vehicles = [] } = useQuery('fleet-vehicles', () => fleetApi.listVehicles());
  const { data: drivers  = [] } = useQuery('fleet-drivers',  () => fleetApi.listDrivers());
  const [f, setF] = useState({
    vehicle_id: '', driver_id: '', fuel_date: new Date().toISOString().slice(0,10),
    litres: '', cost_per_litre: '', total_cost: '', odometer_km: '',
    fuel_station: '', receipt_number: '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation(fleetApi.createFuel, {
    onSuccess: () => { toast.success('Fuel log recorded.'); qc.invalidateQueries('fleet-fuel'); qc.invalidateQueries('fleet-dashboard'); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <Modal title="Record Fuel Purchase" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vehicle" required>
          <select className={sel} value={f.vehicle_id} onChange={e => set('vehicle_id', e.target.value)}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.make} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Driver">
          <select className={sel} value={f.driver_id} onChange={e => set('driver_id', e.target.value)}>
            <option value="">— Select driver —</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input type="date" className={inp} value={f.fuel_date} onChange={e => set('fuel_date', e.target.value)} />
        </Field>
        <Field label="Odometer (km)" required>
          <input type="number" className={inp} value={f.odometer_km} onChange={e => set('odometer_km', e.target.value)} />
        </Field>
        <Field label="Litres" required>
          <input type="number" className={inp} value={f.litres} onChange={e => set('litres', e.target.value)} step="0.01" />
        </Field>
        <Field label="Cost per Litre (GHS)">
          <input type="number" className={inp} value={f.cost_per_litre} onChange={e => set('cost_per_litre', e.target.value)} step="0.001" />
        </Field>
        <Field label="Total Cost (GHS)">
          <input type="number" className={inp} value={f.total_cost} onChange={e => set('total_cost', e.target.value)} />
        </Field>
        <Field label="Fuel Station">
          <input className={inp} value={f.fuel_station} onChange={e => set('fuel_station', e.target.value)} />
        </Field>
        <Field label="Receipt Number">
          <input className={inp} value={f.receipt_number} onChange={e => set('receipt_number', e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => mut.mutate(f)} disabled={mut.isLoading || !f.vehicle_id} className="btn-primary text-sm py-2 px-4">
          {mut.isLoading ? 'Saving…' : 'Record Fuel'}
        </button>
      </div>
    </Modal>
  );
}

// ── Maintenance Modal ─────────────────────────────────────────────────────────
function MaintenanceModal({ record, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!record;
  const { data: vehicles = [] } = useQuery('fleet-vehicles', () => fleetApi.listVehicles());
  const [f, setF] = useState({
    vehicle_id: record?.vehicle_id || '',
    maintenance_type: record?.maintenance_type || 'preventive',
    description: record?.description || '',
    workshop: record?.workshop || '',
    cost: record?.cost || '',
    service_date: record?.service_date?.slice(0,10) || new Date().toISOString().slice(0,10),
    odometer_at_service: record?.odometer_at_service || '',
    start_date: record?.start_date?.slice(0,10) || '',
    end_date: record?.end_date?.slice(0,10) || '',
    status: record?.status || 'scheduled',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation(
    d => isEdit ? fleetApi.updateMaintenance(record.id, d) : fleetApi.createMaintenance(d),
    {
      onSuccess: () => { toast.success(isEdit ? 'Record updated.' : 'Maintenance scheduled.'); qc.invalidateQueries('fleet-maintenance'); qc.invalidateQueries('fleet-vehicles'); qc.invalidateQueries('fleet-dashboard'); onClose(); },
      onError: e => toast.error(e.response?.data?.error || 'Failed.'),
    }
  );

  return (
    <Modal title={isEdit ? 'Update Maintenance' : 'Schedule Maintenance'} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vehicle" required>
          <select className={sel} value={f.vehicle_id} onChange={e => set('vehicle_id', e.target.value)} disabled={isEdit}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.make} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Type" required>
          <select className={sel} value={f.maintenance_type} onChange={e => set('maintenance_type', e.target.value)}>
            {MAINT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Description" required>
            <textarea className={inp} rows={2} value={f.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </div>
        <Field label="Workshop">
          <input className={inp} value={f.workshop} onChange={e => set('workshop', e.target.value)} />
        </Field>
        <Field label="Cost (GHS)">
          <input type="number" className={inp} value={f.cost} onChange={e => set('cost', e.target.value)} />
        </Field>
        <Field label="Service Date" required>
          <input type="date" className={inp} value={f.service_date} onChange={e => set('service_date', e.target.value)} />
        </Field>
        <Field label="Odometer at Service (km)">
          <input type="number" className={inp} value={f.odometer_at_service} onChange={e => set('odometer_at_service', e.target.value)} />
        </Field>
        <Field label="Start Date">
          <input type="date" className={inp} value={f.start_date} onChange={e => set('start_date', e.target.value)} />
        </Field>
        <Field label="End Date">
          <input type="date" className={inp} value={f.end_date} onChange={e => set('end_date', e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={sel} value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
        <button onClick={() => mut.mutate(f)} disabled={mut.isLoading || !f.vehicle_id} className="btn-primary text-sm py-2 px-4">
          {mut.isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule'}
        </button>
      </div>
    </Modal>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery('fleet-dashboard', fleetApi.dashboard, { refetchInterval: 60000 });
  const dismissMut = useMutation(fleetApi.dismissAlert, {
    onSuccess: () => { toast.success('Alert dismissed.'); qc.invalidateQueries('fleet-dashboard'); },
  });
  if (isLoading) return <Spinner />;
  const v = data?.vehicles || {}; const m = data?.mileage || {}; const f = data?.fuel || {};
  const maint = data?.maintenance || {}; const alerts = data?.alerts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-600">Fleet Overview — auto-refreshes every 60s</h2>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><RefreshCw size={15}/></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Active Vehicles"     value={v.active}             icon={Truck}    accent="green" />
        <KPICard label="Under Maintenance"   value={v.under_maintenance}  icon={Wrench}   accent="amber" />
        <KPICard label="Out of Service"      value={v.out_of_service}     icon={XCircle}  accent="red"   />
        <KPICard label="Total Fleet"         value={v.total}              icon={Activity}                />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="KM This Month"       value={fmtNum(m.total_km_this_month,1)}  icon={MapPin}      accent="blue" sub="km driven" />
        <KPICard label="Pending Approvals"   value={m.pending_approvals}              icon={Clock}       accent={m.pending_approvals > 0 ? 'amber' : null} />
        <KPICard label="Fuel This Month"     value={fmtNum(f.litres_this_month,1)+' L'} icon={Fuel}      />
        <KPICard label="Maintenance Open"    value={maint.open_jobs}                  icon={Wrench}      accent={maint.open_jobs > 0 ? 'amber' : null} />
      </div>

      {alerts.length > 0 && (
        <div className="border border-orange-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <Bell size={14} className="text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {alerts.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                <AlertTriangle size={14} className={clsx('mt-0.5 shrink-0', ALERT_ICON[a.alert_type]?.cls || 'text-gray-400')} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{ALERT_ICON[a.alert_type]?.label}</span>
                  <p className="text-sm text-gray-700">{a.message}</p>
                  <p className="text-xs text-gray-400">{fmtDate(a.created_at)}</p>
                </div>
                <button onClick={() => dismissMut.mutate(a.id)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Dismiss</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vehicles Tab ──────────────────────────────────────────────────────────────
function VehiclesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);

  const { data: vehicles = [], isLoading } = useQuery(
    ['fleet-vehicles', statusFilter, search],
    () => fleetApi.listVehicles({ status: statusFilter || undefined, search: search || undefined }),
    { keepPreviousData: true }
  );

  const statusMut = useMutation(({ id, status }) => fleetApi.setVehicleStatus(id, status), {
    onSuccess: () => { toast.success('Status updated.'); qc.invalidateQueries('fleet-vehicles'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input className={clsx(inp, 'max-w-xs')} placeholder="Search registration, make, model…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={clsx(sel, 'w-44')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="under_maintenance">Under Maintenance</option>
          <option value="out_of_service">Out of Service</option>
        </select>
        <button onClick={() => { setEditVehicle(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto shrink-0">
          <Plus size={14}/> Register Vehicle
        </button>
      </div>

      {isLoading ? <Spinner /> : !vehicles.length ? <EmptyState msg="No vehicles found." /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Registration','Make / Model','Year','Odometer','Fuel','Service Interval','Insurance','Roadworthy','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{v.registration_number}</td>
                  <td className="px-4 py-2.5 text-gray-700">{v.make} {v.model}</td>
                  <td className="px-4 py-2.5 text-gray-500">{v.year_of_manufacture || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700">{fmtNum(v.current_odometer_km,0)} km</td>
                  <td className="px-4 py-2.5 capitalize text-gray-600">{v.fuel_type}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v.service_interval_km?.toLocaleString()} km</td>
                  <td className={clsx('px-4 py-2.5 text-xs', v.insurance_expiry && new Date(v.insurance_expiry) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                    {fmtDate(v.insurance_expiry)}
                  </td>
                  <td className={clsx('px-4 py-2.5 text-xs', v.roadworthy_expiry && new Date(v.roadworthy_expiry) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                    {fmtDate(v.roadworthy_expiry)}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white"
                      value={v.status}
                      onChange={e => statusMut.mutate({ id: v.id, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="under_maintenance">Under Maintenance</option>
                      <option value="out_of_service">Out of Service</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => { setEditVehicle(v); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                      <Pencil size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <VehicleModal vehicle={editVehicle} onClose={() => { setShowModal(false); setEditVehicle(null); }} />}
    </div>
  );
}

// ── Drivers Tab ───────────────────────────────────────────────────────────────
function DriversTab() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);

  const { data: drivers = [], isLoading } = useQuery(
    ['fleet-drivers', search],
    () => fleetApi.listDrivers({ search: search || undefined }),
    { keepPreviousData: true }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input className={clsx(inp, 'max-w-xs')} placeholder="Search name, license, employee ID…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => { setEditDriver(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={14}/> Add Driver
        </button>
      </div>

      {isLoading ? <Spinner /> : !drivers.length ? <EmptyState msg="No drivers found." /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name','Employee No.','Phone','License No.','Class','License Expiry','Trips (Month)','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{d.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.employee_number || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{d.phone || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{d.license_number}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.license_class || '—'}</td>
                  <td className={clsx('px-4 py-2.5 text-xs', d.license_expiry && new Date(d.license_expiry) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600')}>
                    {fmtDate(d.license_expiry)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{d.trips_this_month || 0}</td>
                  <td className="px-4 py-2.5"><Badge map={DRIVER_STATUS} value={d.status}/></td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => { setEditDriver(d); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <DriverModal driver={editDriver} onClose={() => { setShowModal(false); setEditDriver(null); }} />}
    </div>
  );
}

// ── Mileage Tab ───────────────────────────────────────────────────────────────
function MileageTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: logs = [], isLoading } = useQuery(
    ['fleet-mileage', statusFilter],
    () => fleetApi.listMileage({ status: statusFilter || undefined }),
    { keepPreviousData: true }
  );

  const approveMut = useMutation(fleetApi.approveMileage, {
    onSuccess: () => { toast.success('Approved.'); qc.invalidateQueries('fleet-mileage'); qc.invalidateQueries('fleet-dashboard'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed.'),
  });
  const rejectMut = useMutation(id => fleetApi.rejectMileage(id, { reason: 'Rejected by reviewer' }), {
    onSuccess: () => { toast.success('Rejected.'); qc.invalidateQueries('fleet-mileage'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className={clsx(sel, 'w-40')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={14}/> Log Trip
        </button>
      </div>

      {isLoading ? <Spinner /> : !logs.length ? <EmptyState msg="No mileage logs found." /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date','Vehicle','Driver','Start','End','Distance','Purpose','Origin → Dest','Fuel','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className={clsx('hover:bg-gray-50', l.is_flagged && 'bg-red-50/40')}>
                  <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmtDate(l.trip_date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800 text-xs">{l.registration_number}</td>
                  <td className="px-3 py-2.5 text-gray-700 text-xs">{l.driver_name}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{fmtNum(l.odometer_start,0)}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{fmtNum(l.odometer_end,0)}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{fmtNum(l.distance_km,1)} km</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[140px] truncate">{l.trip_purpose}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{l.origin && l.destination ? `${l.origin} → ${l.destination}` : l.origin || l.destination || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{l.fuel_added_litres ? `${l.fuel_added_litres}L` : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <Badge map={MILEAGE_STATUS} value={l.status}/>
                      {l.is_flagged && <span className="text-xs text-red-500">⚠ Flagged</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {l.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => approveMut.mutate(l.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve">
                          <CheckCircle size={13}/>
                        </button>
                        <button onClick={() => rejectMut.mutate(l.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Reject">
                          <XCircle size={13}/>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <MileageModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Fuel Tab ──────────────────────────────────────────────────────────────────
function FuelTab() {
  const [showModal, setShowModal] = useState(false);
  const { data: logs = [], isLoading } = useQuery('fleet-fuel', () => fleetApi.listFuel());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={14}/> Record Fuel
        </button>
      </div>

      {isLoading ? <Spinner /> : !logs.length ? <EmptyState msg="No fuel records found." /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date','Vehicle','Driver','Odometer','Litres','Cost/L','Total Cost','Station','Receipt'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmtDate(l.fuel_date)}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{l.registration_number}</td>
                  <td className="px-4 py-2.5 text-gray-600">{l.driver_name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtNum(l.odometer_km,0)} km</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{fmtNum(l.litres,2)} L</td>
                  <td className="px-4 py-2.5 text-gray-600">GHS {l.cost_per_litre ? parseFloat(l.cost_per_litre).toFixed(3) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{l.total_cost ? `GHS ${parseFloat(l.total_cost).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.fuel_station || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{l.receipt_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <FuelModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Maintenance Tab ───────────────────────────────────────────────────────────
function MaintenanceTab() {
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: records = [], isLoading } = useQuery(
    ['fleet-maintenance', statusFilter],
    () => fleetApi.listMaintenance({ status: statusFilter || undefined }),
    { keepPreviousData: true }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className={clsx(sel, 'w-44')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => { setEditRecord(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 ml-auto">
          <Plus size={14}/> Schedule Maintenance
        </button>
      </div>

      {isLoading ? <Spinner /> : !records.length ? <EmptyState msg="No maintenance records found." /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vehicle','Type','Description','Workshop','Cost','Service Date','Next Service','Odometer','Downtime','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{r.registration_number}</td>
                  <td className="px-3 py-2.5 capitalize text-gray-600 text-xs">{r.maintenance_type?.replace(/_/g,' ')}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs max-w-[160px] truncate">{r.description}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{r.workshop || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-700 text-xs">{r.cost ? `GHS ${parseFloat(r.cost).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmtDate(r.service_date)}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-blue-600">{r.next_service_km ? `${parseInt(r.next_service_km).toLocaleString()} km` : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{r.odometer_at_service ? `${parseInt(r.odometer_at_service).toLocaleString()} km` : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{r.downtime_days != null ? `${r.downtime_days}d` : '—'}</td>
                  <td className="px-3 py-2.5"><Badge map={MAINT_STATUS} value={r.status}/></td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => { setEditRecord(r); setShowModal(true); }} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <MaintenanceModal record={editRecord} onClose={() => { setShowModal(false); setEditRecord(null); }} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FleetPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-sm text-gray-500">Vehicles · Drivers · Mileage · Fuel · Maintenance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}>
              <Icon size={14}/> {label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {tab === 'dashboard'   && <DashboardTab />}
        {tab === 'vehicles'    && <VehiclesTab />}
        {tab === 'drivers'     && <DriversTab />}
        {tab === 'mileage'     && <MileageTab />}
        {tab === 'fuel'        && <FuelTab />}
        {tab === 'maintenance' && <MaintenanceTab />}
      </div>
    </div>
  );
}
