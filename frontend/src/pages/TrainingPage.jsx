import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { GraduationCap, CheckCircle, XCircle, Clock, AlertTriangle, Plus, X, ChevronDown, Users, BookOpen, Calendar, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { trainingApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  current:  { label: 'Current',    bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  icon: CheckCircle },
  due_soon: { label: 'Due Soon',   bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  icon: Clock },
  expired:  { label: 'Expired',    bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      icon: XCircle },
  never:    { label: 'Not Done',   bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-500 dark:text-gray-400',    icon: AlertTriangle },
};

function StatusChip({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.never;
  const Icon = cfg.icon;
  if (small) {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${cfg.bg}`} title={cfg.label}>
        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function KPICard({ label, value, sub, accent }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    red:    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    gray:   'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <div className="text-2xl font-bold">{value ?? '—'}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ onClose }) {
  const { data: types  = [] } = useQuery('training:types', trainingApi.listTypes);
  const { data: teams  = [] } = useQuery('training:teams', trainingApi.listTeams);

  const [mode,   setMode]   = useState('filtered'); // 'filtered' | 'matrix'
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);

  async function doExport() {
    setLoading(true);
    try {
      let blob, filename;
      if (mode === 'matrix') {
        blob = await trainingApi.exportMatrix(teamId ? { team_id: teamId } : {});
        const d = new Date().toISOString().slice(0,10);
        filename = `Training-Matrix-${d}.xlsx`;
      } else {
        const params = {};
        if (typeId)  params.training_type_id = typeId;
        if (status)  params.status = status;
        if (teamId)  params.team_id = teamId;
        blob = await trainingApi.exportRecords(params);
        const typeCode  = types.find(t => String(t.id) === String(typeId))?.code || 'All';
        const statusStr = status ? status.replace('_','-') : 'All';
        const d = new Date().toISOString().slice(0,10);
        filename = `Training-${typeCode}-${statusStr}-${d}.xlsx`;
      }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Export failed. No records may match the filters.');
    } finally {
      setLoading(false);
    }
  }

  const STATUS_OPTIONS = [
    { value: '',         label: 'All statuses' },
    { value: 'expired',  label: 'Expired' },
    { value: 'due_soon', label: 'Due Soon (next 30 days)' },
    { value: 'current',  label: 'Current' },
    { value: 'never',    label: 'Never Done' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Export Training Data</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'filtered', label: 'Filtered List',   desc: 'Staff × training rows, filterable by type & status' },
              { key: 'matrix',   label: 'Full Matrix',     desc: 'All staff in rows, each training type as a column' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${
                  mode === m.key
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${mode === m.key ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                  {m.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Team filter — both modes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Team (optional)</label>
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Filtered-mode filters */}
          {mode === 'filtered' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Training Type</label>
                <select
                  value={typeId}
                  onChange={e => setTypeId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">All training types</option>
                  {types.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status Filter</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {STATUS_OPTIONS.map(o => (
                    <label key={o.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      status === o.value
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                      <input type="radio" name="status" value={o.value} checked={status === o.value} onChange={() => setStatus(o.value)} className="accent-blue-600" />
                      <span className={`text-sm font-medium ${
                        o.value === 'expired'  ? 'text-red-600' :
                        o.value === 'due_soon' ? 'text-amber-600' :
                        o.value === 'current'  ? 'text-green-600' :
                        o.value === 'never'    ? 'text-gray-500' :
                        'text-gray-700 dark:text-gray-200'
                      }`}>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Summary line */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            {mode === 'matrix'
              ? `Will export: Full compliance matrix${teamId ? ` for selected team` : ', all teams'}`
              : `Will export: ${typeId ? types.find(t=>String(t.id)===String(typeId))?.name || 'selected type' : 'All training types'} — ${STATUS_OPTIONS.find(o=>o.value===status)?.label || 'All statuses'}${teamId ? ', selected team' : ''}`
            }
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={doExport}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {loading ? 'Generating…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Training Modal ───────────────────────────────────────────────────────
function LogTrainingModal({ onClose, prefillStaffId, prefillTypeId }) {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery('training:types', trainingApi.listTypes);
  const { data: matrixData } = useQuery(['training:matrix', null], () => trainingApi.getMatrix({}));
  const staffList = matrixData?.staff ?? [];

  const [form, setForm] = useState({
    staff_id: prefillStaffId ?? '',
    training_type_id: prefillTypeId ?? '',
    completion_date: '',
    certificate_ref: '',
    notes: '',
  });

  const { mutate, isLoading } = useMutation(trainingApi.createRecord, {
    onSuccess: () => {
      toast.success('Training record saved');
      qc.invalidateQueries('training:dashboard');
      qc.invalidateQueries('training:matrix');
      qc.invalidateQueries('training:records');
      qc.invalidateQueries('training:upcoming');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  function submit(e) {
    e.preventDefault();
    if (!form.staff_id || !form.training_type_id || !form.completion_date) {
      return toast.error('Staff, training type and completion date are required');
    }
    mutate(form);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Log Training</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff Member *</label>
            <select
              value={form.staff_id}
              onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              required
            >
              <option value="">Select staff…</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.team_name ? `— ${s.team_name}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Training Type *</label>
            <select
              value={form.training_type_id}
              onChange={e => setForm(f => ({ ...f, training_type_id: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              required
            >
              <option value="">Select training…</option>
              {types.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name} (valid {t.validity_months} months)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Date *</label>
            <input
              type="date"
              value={form.completion_date}
              onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Certificate / Reference No.</label>
            <input
              type="text"
              value={form.certificate_ref}
              onChange={e => setForm(f => ({ ...f, certificate_ref: e.target.value }))}
              placeholder="Optional"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {isLoading ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ onLogTraining }) {
  const { data: dash } = useQuery('training:dashboard', trainingApi.getDashboard);
  const { data: upcoming } = useQuery(['training:upcoming', 30], () => trainingApi.getUpcoming(30));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Staff" value={dash?.total_staff} accent="blue" />
        <KPICard label="Current Records" value={dash?.current_records} sub="Up to date" accent="green" />
        <KPICard label="Due Within 30 Days" value={dash?.due_soon} accent="amber" />
        <KPICard label="Expired / Never Done" value={(dash?.expired_records ?? 0) + (dash?.never_trained ?? 0)} accent="red" />
      </div>

      {/* Per-training breakdown */}
      {dash?.by_type?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Compliance by Training Type</h3>
          <div className="space-y-3">
            {dash.by_type.map(t => {
              const total = (t.current_count + t.expired_count + t.never_trained_count) || 1;
              const pct = Math.round((t.current_count / total) * 100);
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.name}</span>
                    <span className="text-sm text-gray-500">{t.current_count}/{dash.total_staff} current ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span className="text-green-600">{t.current_count} current</span>
                    <span className="text-red-500">{t.expired_count} expired</span>
                    <span className="text-gray-400">{t.never_trained_count} not done</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expiring soon */}
      {upcoming?.expiring?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Expiring Within 30 Days</h3>
          <div className="divide-y dark:divide-gray-700">
            {upcoming.expiring.slice(0, 10).map(r => (
              <div key={r.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.staff_name}</div>
                  <div className="text-xs text-gray-500">{r.team_name} · {r.training_name}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${r.days_until_expiry <= 0 ? 'text-red-600' : r.days_until_expiry <= 14 ? 'text-amber-600' : 'text-yellow-600'}`}>
                    {r.days_until_expiry <= 0 ? `${Math.abs(r.days_until_expiry)}d overdue` : `${r.days_until_expiry}d left`}
                  </div>
                  <div className="text-xs text-gray-400">{new Date(r.expiry_date).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Matrix Tab ───────────────────────────────────────────────────────────────
function MatrixTab({ onLogTraining }) {
  const [teamId, setTeamId] = useState('');
  const { data: teams = [] } = useQuery('training:teams', trainingApi.listTeams);
  const { data, isLoading } = useQuery(
    ['training:matrix', teamId],
    () => trainingApi.getMatrix(teamId ? { team_id: teamId } : {}),
    { keepPreviousData: true }
  );

  const types = data?.types ?? [];
  const staff = data?.staff ?? [];

  // Group staff by team
  const grouped = staff.reduce((acc, s) => {
    const key = s.team_name || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 appearance-none"
          >
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => {
            const Icon = v.icon;
            return (
              <span key={k} className="flex items-center gap-1">
                <Icon className={`w-3.5 h-3.5 ${v.text}`} />{v.label}
              </span>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">Staff Member</th>
                {types.map(t => (
                  <th key={t.id} className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-300 text-center min-w-[90px]">
                    <div className="text-xs leading-tight">{t.name.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="text-xs text-gray-400 font-normal">{t.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([teamName, members]) => (
                <>
                  <tr key={`team-${teamName}`} className="bg-gray-50 dark:bg-gray-750">
                    <td colSpan={types.length + 1} className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {teamName}
                    </td>
                  </tr>
                  {members.map(s => (
                    <tr key={s.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{s.name}</div>
                        <div className="text-xs text-gray-400 capitalize">{s.role?.replace('_', ' ')}</div>
                      </td>
                      {types.map(t => {
                        const rec = s.trainings?.[t.id];
                        return (
                          <td key={t.id} className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => onLogTraining(s.id, t.id)}
                              className="group relative"
                              title={rec?.expiry_date ? `Expires ${new Date(rec.expiry_date).toLocaleDateString()}` : 'Click to log training'}
                            >
                              <StatusChip status={rec?.status ?? 'never'} small />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Records Tab ──────────────────────────────────────────────────────────────
function RecordsTab({ onLogTraining }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', page: 1 });
  const { data, isLoading } = useQuery(
    ['training:records', filters],
    () => trainingApi.listRecords(filters),
    { keepPreviousData: true }
  );
  const { mutate: del } = useMutation(trainingApi.deleteRecord, {
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries('training:records'); qc.invalidateQueries('training:dashboard'); qc.invalidateQueries('training:matrix'); },
  });
  const { hasPermission } = useAuth();
  const canManage = hasPermission('training.manage');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">All Status</option>
          <option value="current">Current</option>
          <option value="due_soon">Due Soon</option>
          <option value="expired">Expired</option>
        </select>
        {canManage && (
          <button
            onClick={() => onLogTraining()}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Log Training
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b dark:border-gray-700">
            <tr>
              {['Staff Member', 'Team', 'Training', 'Completed', 'Expires', 'Status', 'Cert Ref', canManage && ''].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : !data?.rows?.length ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No records found</td></tr>
            ) : data.rows.map(r => {
              const exp = new Date(r.expiry_date);
              const today = new Date();
              const status = exp <= today ? 'expired' : exp <= new Date(today.getTime() + 30 * 86400000) ? 'due_soon' : 'current';
              return (
                <tr key={r.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{r.staff_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.team_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-700 dark:text-gray-200">{r.training_name}</div>
                    <div className="text-xs text-gray-400">{r.training_code}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Date(r.completion_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Date(r.expiry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusChip status={status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.certificate_ref || '—'}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { if (confirm('Delete this record?')) del(r.id); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >Delete</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data?.total > data?.limit && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{data.total} total records</span>
          <div className="flex gap-2">
            <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <span>Page {filters.page}</span>
            <button disabled={filters.page * filters.limit >= data.total} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Due / Upcoming Tab ───────────────────────────────────────────────────────
function UpcomingTab({ onLogTraining }) {
  const [days, setDays] = useState(60);
  const { data, isLoading } = useQuery(['training:upcoming', days], () => trainingApi.getUpcoming(days));
  const { hasPermission } = useAuth();
  const canManage = hasPermission('training.manage');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show expiring within</label>
        <select
          value={days}
          onChange={e => setDays(+e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
          <option value={180}>6 months</option>
        </select>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <>
          {data?.expiring?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-3 border-b dark:border-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-gray-800 dark:text-gray-100">Expiring Within {days} Days ({data.expiring.length})</span>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {data.expiring.map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">{r.staff_name}</div>
                      <div className="text-xs text-gray-500">{r.team_name} · <span className="font-medium">{r.training_name}</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${r.days_until_expiry <= 0 ? 'text-red-600' : r.days_until_expiry <= 14 ? 'text-amber-600' : 'text-yellow-600'}`}>
                          {r.days_until_expiry <= 0 ? `${Math.abs(r.days_until_expiry)}d overdue` : `${r.days_until_expiry}d left`}
                        </div>
                        <div className="text-xs text-gray-400">Expires {new Date(r.expiry_date).toLocaleDateString()}</div>
                      </div>
                      {canManage && (
                        <button onClick={() => onLogTraining(r.staff_id, r.training_type_id)} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200">
                          Renew
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.never_trained?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-3 border-b dark:border-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-gray-800 dark:text-gray-100">Never Trained ({data.never_trained.length})</span>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {data.never_trained.map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">{r.staff_name}</div>
                      <div className="text-xs text-gray-500">{r.team_name} · <span className="font-medium">{r.training_name}</span></div>
                    </div>
                    {canManage && (
                      <button onClick={() => onLogTraining(r.staff_id, r.training_type_id)} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium hover:bg-green-200">
                        Log Training
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data?.expiring?.length && !data?.never_trained?.length && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium">All staff training is up to date!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview',       icon: BookOpen },
  { key: 'matrix',   label: 'Training Matrix', icon: Users },
  { key: 'upcoming', label: 'Due / Upcoming',  icon: Calendar },
  { key: 'records',  label: 'All Records',     icon: GraduationCap },
];

export default function TrainingPage() {
  const [tab, setTab]             = useState('overview');
  const [logModal, setLogModal]   = useState(null);
  const [showExport, setShowExport] = useState(false);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('training.manage');

  function openLogModal(staffId, typeId) {
    setLogModal({ staffId: staffId ?? null, typeId: typeId ?? null });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Staff Training</h1>
            <p className="text-sm text-gray-500">Track training compliance and renewal dates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4 text-green-600" /> Export
          </button>
          {canManage && (
            <button
              onClick={() => openLogModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Log Training
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b dark:border-gray-700">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab onLogTraining={openLogModal} />}
      {tab === 'matrix'   && <MatrixTab   onLogTraining={openLogModal} />}
      {tab === 'upcoming' && <UpcomingTab  onLogTraining={openLogModal} />}
      {tab === 'records'  && <RecordsTab   onLogTraining={openLogModal} />}

      {logModal && (
        <LogTrainingModal
          prefillStaffId={logModal.staffId}
          prefillTypeId={logModal.typeId}
          onClose={() => setLogModal(null)}
        />
      )}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
}
