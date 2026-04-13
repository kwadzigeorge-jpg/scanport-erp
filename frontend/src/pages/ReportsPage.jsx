import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { reportsApi } from '../services/api';
import { format } from 'date-fns';
import { BarChart3, Download, FileText, Users, AlertTriangle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

function downloadBlob(data, filename) {
  const url = URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
        ${active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      <Icon size={15} /> {children}
    </button>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('daily');
  const [daily, setDaily] = useState({ date: today });
  const [dwell, setDwell]  = useState({ from: weekAgo, to: today });
  const [agent, setAgent]  = useState({ from: weekAgo, to: today });
  const [audit, setAudit]  = useState({ from: weekAgo, to: today, page: 1 });

  const dailyQ  = useQuery(['report-daily',  daily],  () => reportsApi.daily(daily).then(r => r.data),  { enabled: tab === 'daily'  });
  const dwellQ  = useQuery(['report-dwell',  dwell],  () => reportsApi.dwellTime(dwell).then(r => r.data),  { enabled: tab === 'dwell'  });
  const agentQ  = useQuery(['report-agent',  agent],  () => reportsApi.agentPerf(agent).then(r => r.data),  { enabled: tab === 'agent'  });
  const auditQ  = useQuery(['report-audit',  audit],  () => reportsApi.audit(audit).then(r => r.data),  { enabled: tab === 'audit'  });
  const exceptQ = useQuery(['report-except'],          () => reportsApi.exceptions({}).then(r => r.data), { enabled: tab === 'exceptions' });

  const handleDownload = async (type) => {
    try {
      let res, filename;
      if (type === 'daily')  { res = await reportsApi.downloadDaily(daily);  filename = `daily-report-${daily.date}.xlsx`; }
      if (type === 'dwell')  { res = await reportsApi.downloadDwell(dwell);  filename = `dwell-time-report.xlsx`; }
      if (type === 'agent')  { res = await reportsApi.downloadAgent(agent);  filename = `agent-performance.xlsx`; }
      if (type === 'audit')  { res = await reportsApi.downloadAudit(audit);  filename = `audit-trail.xlsx`; }
      downloadBlob(res.data, filename);
      toast.success('Download started!');
    } catch { toast.error('Export failed.'); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" /> Reports & Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">Operational data, audit trails, and performance metrics.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <TabBtn active={tab === 'daily'}      onClick={() => setTab('daily')}      icon={FileText}>Daily Ops</TabBtn>
        <TabBtn active={tab === 'dwell'}      onClick={() => setTab('dwell')}      icon={BarChart3}>Dwell Time</TabBtn>
        <TabBtn active={tab === 'agent'}      onClick={() => setTab('agent')}      icon={Users}>Agent Perf.</TabBtn>
        <TabBtn active={tab === 'audit'}      onClick={() => setTab('audit')}      icon={Shield}>Audit Trail</TabBtn>
        <TabBtn active={tab === 'exceptions'} onClick={() => setTab('exceptions')} icon={AlertTriangle}>Exceptions</TabBtn>
      </div>

      {/* ── Daily Operations ── */}
      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div><label className="label">Date</label>
              <input type="date" className="input" value={daily.date} max={today}
                onChange={e => setDaily({ date: e.target.value })} />
            </div>
            <button onClick={() => handleDownload('daily')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
          </div>
          <ReportTable
            loading={dailyQ.isLoading}
            rows={dailyQ.data?.rows}
            columns={[
              { key: 'transaction_id', label: 'Txn ID' },
              { key: 'container_number', label: 'Container' },
              { key: 'agent_name', label: 'Agent' },
              { key: 'area', label: 'Area' },
              { key: 'status', label: 'Status' },
              { key: 'created_at', label: 'Created', fmt: v => v ? format(new Date(v), 'HH:mm') : '—' },
              { key: 'dwell_minutes', label: 'Dwell (min)' },
            ]}
            summary={<span>{dailyQ.data?.total || 0} transactions on {daily.date}</span>}
          />
        </div>
      )}

      {/* ── Dwell Time ── */}
      {tab === 'dwell' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <DateRange state={dwell} setState={setDwell} />
            <button onClick={() => handleDownload('dwell')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
          </div>
          <ReportTable
            loading={dwellQ.isLoading}
            rows={dwellQ.data?.rows}
            columns={[
              { key: 'container_number', label: 'Container' },
              { key: 'agent_name', label: 'Agent' },
              { key: 'area', label: 'Area' },
              { key: 'bay_code', label: 'Bay' },
              { key: 'dwell_minutes', label: 'Minutes' },
              { key: 'dwell_category', label: 'Category' },
              { key: 'time_in',  label: 'In',  fmt: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
              { key: 'time_out', label: 'Out', fmt: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
            ]}
          />
        </div>
      )}

      {/* ── Agent Performance ── */}
      {tab === 'agent' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <DateRange state={agent} setState={setAgent} />
            <button onClick={() => handleDownload('agent')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
          </div>
          <ReportTable
            loading={agentQ.isLoading}
            rows={agentQ.data?.rows}
            columns={[
              { key: 'agent_name', label: 'Agent' },
              { key: 'agent_phone', label: 'Phone' },
              { key: 'total_allocations', label: 'Total' },
              { key: 'completed', label: 'Completed' },
              { key: 'still_in', label: 'In Holding' },
              { key: 'cancelled', label: 'Cancelled' },
              { key: 'avg_dwell_minutes', label: 'Avg Dwell (min)' },
            ]}
          />
        </div>
      )}

      {/* ── Audit Trail ── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <DateRange state={audit} setState={d => setAudit(a => ({ ...a, ...d, page: 1 }))} />
            <button onClick={() => handleDownload('audit')} className="btn-secondary"><Download size={15} /> Export XLSX</button>
          </div>
          <ReportTable
            loading={auditQ.isLoading}
            rows={auditQ.data?.rows}
            columns={[
              { key: 'created_at', label: 'Time', fmt: v => v ? format(new Date(v), 'dd MMM HH:mm:ss') : '—' },
              { key: 'username', label: 'User' },
              { key: 'role', label: 'Role' },
              { key: 'action', label: 'Action' },
              { key: 'entity', label: 'Entity' },
              { key: 'ip_address', label: 'IP' },
            ]}
          />
        </div>
      )}

      {/* ── Exceptions ── */}
      {tab === 'exceptions' && (
        <div className="space-y-4">
          <div className="card p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-700 font-medium">
              <AlertTriangle className="inline mr-1" size={15} />
              Showing {exceptQ.data?.total || 0} containers exceeding {exceptQ.data?.threshold_hours || 3}h dwell threshold
            </p>
          </div>
          <ReportTable
            loading={exceptQ.isLoading}
            rows={exceptQ.data?.rows}
            columns={[
              { key: 'transaction_id', label: 'Txn ID' },
              { key: 'container_number', label: 'Container' },
              { key: 'agent_name', label: 'Agent' },
              { key: 'area', label: 'Area' },
              { key: 'bay_code', label: 'Bay' },
              { key: 'time_in', label: 'Time In', fmt: v => v ? format(new Date(v), 'dd MMM HH:mm') : '—' },
              { key: 'hours_in_holding', label: 'Hours In', fmt: v => v ? `${v}h` : '—' },
              { key: 'exception_type', label: 'Flag' },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function DateRange({ state, setState }) {
  return (
    <>
      <div><label className="label">From</label>
        <input type="date" className="input" value={state.from} onChange={e => setState({ ...state, from: e.target.value })} />
      </div>
      <div><label className="label">To</label>
        <input type="date" className="input" value={state.to}   onChange={e => setState({ ...state, to: e.target.value })} />
      </div>
    </>
  );
}

function ReportTable({ loading, rows, columns, summary }) {
  if (loading) return <div className="text-center py-12 text-gray-400">Loading report…</div>;
  return (
    <div className="card overflow-hidden">
      {summary && <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">{summary}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{columns.map(c => <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!rows?.length ? (
              <tr><td colSpan={columns.length} className="text-center py-10 text-gray-400">No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-2.5 text-gray-700">
                    {c.fmt ? c.fmt(row[c.key]) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
