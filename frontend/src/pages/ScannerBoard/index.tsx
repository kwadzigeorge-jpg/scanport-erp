import { useEffect, useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getBoard, updateScanner, updateHeader, getHistory, clearHistory } from '../../api/scannerBoard';
import type { BoardEntry, BoardState, HistoryEntry } from '../../api/scannerBoard';
import { useAuth } from '../../contexts/AuthContext';
import EditModal from './EditModal';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCANNER_LABELS: Record<string, string> = {
  IMPORT_1: 'IMPORT 1', IMPORT_2: 'IMPORT 2', IMPORT_3: 'IMPORT 3',
  EXPORT_1: 'EXPORT 1', EXPORT_2: 'EXPORT 2', EXPORT_3: 'EXPORT 3',
};

export const SCANNER_IDS = Object.keys(SCANNER_LABELS);

export const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  OPERATIONAL:       { label: 'OPERATIONAL',       color: '#00e676', bg: 'rgba(0,230,118,0.10)', border: '#00e676' },
  UNDER_OBSERVATION: { label: 'UNDER OBSERVATION', color: '#ff9800', bg: 'rgba(255,152,0,0.10)',  border: '#ff9800' },
  NOT_OPERATIONAL:   { label: 'NOT OPERATIONAL',   color: '#f44336', bg: 'rgba(244,67,54,0.10)',  border: '#f44336' },
  TESTING:           { label: 'TESTING',           color: '#29b6f6', bg: 'rgba(41,182,246,0.10)', border: '#29b6f6' },
  STANDBY:           { label: 'STANDBY',           color: '#9e9e9e', bg: 'rgba(158,158,158,0.08)', border: '#9e9e9e' },
};

export const FAULT_LABELS: Record<string, string> = {
  'NO_ISSUES':               'NO ISSUES',
  'OCR_FAULT':               'OCR FAULT',
  'IPS_FAULT':               'IPS FAULT',
  'ACCELERATOR_MAJOR_FAULT': 'ACCELERATOR MAJOR FAULT',
  'CCTV_FAULT':              'CCTV FAULT',
  'NO_IMAGE_AFTER_SCAN':     'NO IMAGE AFTER SCAN',
  'DAISY_FAULT':             'DAISY FAULT',
  'BOOM_BARRIER_FAULT':      'BOOM BARRIER FAULT',
  'POWER_OUTAGE':            'POWER OUTAGE',
  'VEHICLE_STUCK':           'VEHICLE STUCK / BREAKDOWN',
  'OTHER':                   'OTHER',
};

const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'];

const S = {
  bg:      '#0d0d0d',
  card:    '#111',
  border:  '#1e1e1e',
  border2: '#2a2a2a',
  text:    '#ccc',
  dim:     '#555',
  green:   '#00e676',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScannerBoard() {
  const { user } = useAuth();
  const [board, setBoard]         = useState<BoardState | null>(null);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [date, setDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shift, setShift]         = useState('MORNING');
  const [preparedBy, setPreparedBy] = useState('');
  const [editScanner, setEditScanner] = useState<BoardEntry | null>(null);
  const [editCell, setEditCell]   = useState<'fault' | 'remarks' | 'asset' | null>(null);
  const prepTimeout               = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const [b, h] = await Promise.all([getBoard(date, shift), getHistory(date, shift)]);
      setBoard(b);
      setHistory(h);
      if (b.preparedBy) setPreparedBy(b.preparedBy);
    } catch { toast.error('Failed to load board.'); }
    finally { setLoading(false); }
  }, [date, shift]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  function handlePreparedByChange(val: string) {
    setPreparedBy(val);
    clearTimeout(prepTimeout.current);
    prepTimeout.current = setTimeout(() => {
      updateHeader(date, shift, val).catch(() => {});
    }, 800);
  }

  async function handleSave(scanner: string, data: Partial<BoardEntry>) {
    try {
      await updateScanner(scanner, { ...data, date, shift } as any);
      toast.success('Saved.');
      setEditScanner(null);
      load();
    } catch { toast.error('Save failed.'); }
  }

  async function handleClearHistory() {
    if (!confirm('Clear update history for this shift?')) return;
    await clearHistory(date, shift);
    setHistory([]);
  }

  function openEdit(entry: BoardEntry, cell: 'fault' | 'remarks' | 'asset') {
    setEditScanner(entry);
    setEditCell(cell);
  }

  const entryMap = Object.fromEntries(
    (board?.board || []).map(e => [e.scanner, e])
  );

  // Status counters
  const counts = Object.fromEntries(Object.keys(STATUS_META).map(s => [s, 0]));
  (board?.board || []).forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });

  if (loading) return (
    <div style={{ background: S.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.green, fontFamily: 'monospace', fontSize: 18 }}>LOADING SCANNER STATUS...</div>
    </div>
  );

  return (
    <div style={{ background: S.bg, minHeight: '100vh', fontFamily: "'Courier New', Courier, monospace", color: S.text, padding: '0 0 40px' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 24px 12px', borderBottom: `1px solid ${S.border2}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: S.green, fontSize: 26, fontWeight: 'bold', letterSpacing: 4, margin: 0, textTransform: 'uppercase' }}>
              HCVP SCANNER STATUS
            </h1>
            <div style={{ color: S.dim, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>
              &gt; CROSS-FUNCTIONAL MEETING DASHBOARD – CLICK ANY CELL TO UPDATE
            </div>
          </div>

          {/* Date / Prepared By / Shift */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 11, letterSpacing: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: S.dim }}>// DATE</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: S.dim }}>// PREPARED BY</span>
              <input
                type="text"
                value={preparedBy}
                onChange={e => handlePreparedByChange(e.target.value)}
                placeholder="name / role"
                style={{ ...inputStyle, width: 140 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: S.dim }}>// SHIFT</span>
              <select
                value={shift}
                onChange={e => setShift(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- select --</option>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Status counter cards */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{
              border: `1px solid ${meta.border}`,
              background: meta.bg,
              borderRadius: 4,
              padding: '10px 18px',
              minWidth: 110,
              flex: '1 1 100px',
            }}>
              <div style={{ color: S.dim, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{meta.label}</div>
              <div style={{ color: meta.color, fontSize: 32, fontWeight: 'bold', lineHeight: 1 }}>{counts[key] || 0}</div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: meta.color, letterSpacing: 1 }}>
              <div style={{ width: 10, height: 10, background: meta.color, borderRadius: 2 }} />
              {meta.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px repeat(6, 1fr)',
          border: `1px solid ${S.border2}`,
          borderRadius: 4,
          overflow: 'hidden',
          minWidth: 760,
        }}>

          {/* ── ASSET ROW ── */}
          <RowLabel label="ASSET" />
          {SCANNER_IDS.map(id => {
            const entry = entryMap[id] || { scanner: id, status: 'OPERATIONAL', faultType: null, scanCount: 0 } as BoardEntry;
            const meta = STATUS_META[entry.status] || STATUS_META.OPERATIONAL;
            return (
              <div
                key={id}
                onClick={() => openEdit(entry, 'asset')}
                style={{
                  background: meta.bg,
                  borderLeft: `1px solid ${S.border2}`,
                  borderBottom: `1px solid ${S.border2}`,
                  padding: '12px 10px',
                  cursor: 'pointer',
                  transition: 'opacity .15s',
                  minHeight: 80,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ color: meta.color, fontSize: 12, fontWeight: 'bold', letterSpacing: 1, textAlign: 'center' }}>
                  {SCANNER_LABELS[id]}
                </div>
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <span style={{ color: meta.color, fontSize: 22, fontWeight: 'bold' }}>{entry.scanCount}</span>
                  <span style={{ color: S.dim, fontSize: 10, marginLeft: 4 }}>scans</span>
                </div>
              </div>
            );
          })}

          {/* ── FAULT / HISTORY ROW ── */}
          <RowLabel label="FAULT / HISTORY" />
          {SCANNER_IDS.map(id => {
            const entry = entryMap[id] || { scanner: id, status: 'OPERATIONAL', faultType: null, faultNote: null } as BoardEntry;
            const hasFault = entry.faultType && entry.faultType !== 'NO_ISSUES';
            const faultColor = hasFault ? '#f44336' : S.green;
            const faultLabel = entry.faultType ? (FAULT_LABELS[entry.faultType] || entry.faultType) : 'NO ISSUES';
            const meta = STATUS_META[entry.status] || STATUS_META.OPERATIONAL;
            return (
              <div
                key={id}
                onClick={() => openEdit(entry, 'fault')}
                style={{
                  background: S.card,
                  borderLeft: `1px solid ${S.border2}`,
                  borderBottom: `1px solid ${S.border2}`,
                  padding: '10px 10px',
                  cursor: 'pointer',
                  minHeight: 100,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#181818')}
                onMouseLeave={e => (e.currentTarget.style.background = S.card)}
              >
                <Badge label={faultLabel} color={faultColor} />
                {entry.faultNote && (
                  <div style={{ color: S.dim, fontSize: 9, marginTop: 5, lineHeight: 1.4, letterSpacing: 0.5 }}>
                    {entry.faultNote}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── UPDATE / REMARKS ROW ── */}
          <RowLabel label="UPDATE / REMARKS" />
          {SCANNER_IDS.map(id => {
            const entry = entryMap[id] || { scanner: id, status: 'OPERATIONAL', updateRemark: null } as BoardEntry;
            const meta = STATUS_META[entry.status] || STATUS_META.OPERATIONAL;
            return (
              <div
                key={id}
                onClick={() => openEdit(entry, 'remarks')}
                style={{
                  background: S.card,
                  borderLeft: `1px solid ${S.border2}`,
                  padding: '10px 10px',
                  cursor: 'pointer',
                  minHeight: 90,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#181818')}
                onMouseLeave={e => (e.currentTarget.style.background = S.card)}
              >
                <Badge label={meta.label} color={meta.color} />
                {entry.updateRemark && (
                  <div style={{ color: S.dim, fontSize: 9, marginTop: 5, lineHeight: 1.4, letterSpacing: 0.5 }}>
                    {entry.updateRemark}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Update History ── */}
      <div style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ color: S.green, fontSize: 13, letterSpacing: 2, fontWeight: 'bold' }}>
            &gt;&gt; UPDATE HISTORY
            <span style={{ color: S.dim, fontSize: 10, fontWeight: 'normal', marginLeft: 10 }}>// auto-recorded on every save</span>
          </div>
          <button
            onClick={handleClearHistory}
            style={{
              background: 'transparent', border: `1px solid ${S.border2}`,
              color: S.dim, fontSize: 10, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'monospace', letterSpacing: 1,
            }}
          >
            [ CLEAR HISTORY ]
          </button>
        </div>

        <div style={{ border: `1px solid ${S.border2}`, borderRadius: 4, overflow: 'hidden' }}>
          {/* History header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '160px 110px 1fr 70px',
            background: '#0a0a0a', padding: '6px 14px',
            borderBottom: `1px solid ${S.border2}`,
            fontSize: 10, color: S.dim, letterSpacing: 2, textTransform: 'uppercase',
          }}>
            <span>TIMESTAMP</span><span>SCANNER</span><span>CHANGES</span><span style={{ textAlign: 'right' }}>SESSION</span>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '20px 14px', color: S.dim, fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
              NO HISTORY FOR THIS SHIFT
            </div>
          ) : (
            history.slice(0, 30).map((h, i) => (
              <HistoryRow key={h.id} entry={h} odd={i % 2 === 1} />
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editScanner && editCell && (
        <EditModal
          entry={editScanner}
          focusCell={editCell}
          date={date}
          shift={shift}
          onSave={handleSave}
          onClose={() => { setEditScanner(null); setEditCell(null); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowLabel({ label }: { label: string }) {
  return (
    <div style={{
      background: '#0a0a0a',
      borderBottom: `1px solid #1e1e1e`,
      borderRight: `1px solid #1e1e1e`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 4,
    }}>
      <div style={{
        color: '#555', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      display: 'inline-block',
      border: `1px solid ${color}`,
      color,
      fontSize: 9,
      padding: '2px 6px',
      letterSpacing: 1,
      borderRadius: 2,
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {label}
    </div>
  );
}

function HistoryRow({ entry, odd }: { entry: HistoryEntry; odd: boolean }) {
  const ts = format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm:ss');
  const scannerLabel = entry.scanner.replace('_', ' ');
  const scannerColor = entry.scanner.startsWith('IMPORT') ? '#00e676' : '#ff9800';

  const FIELD_LABELS: Record<string, string> = {
    status: 'Status', faultType: 'Fault', faultNote: 'Fault note',
    updateRemark: 'Update', scanCount: 'Scans',
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '160px 110px 1fr 70px',
      padding: '8px 14px',
      borderBottom: '1px solid #161616',
      background: odd ? '#0f0f0f' : 'transparent',
      fontSize: 11,
      alignItems: 'start',
    }}>
      <span style={{ color: '#00e676', fontSize: 10 }}>{ts}</span>
      <span style={{ color: scannerColor, fontWeight: 'bold', fontSize: 10, letterSpacing: 1 }}>{scannerLabel}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entry.changes.map((c, i) => (
          <div key={i} style={{ fontSize: 10, color: '#888' }}>
            {FIELD_LABELS[c.field] || c.field}:{' '}
            <span style={{ color: '#f44336' }}>{formatChangeVal(c.from)}</span>
            {' → '}
            <span style={{ color: '#00e676' }}>{formatChangeVal(c.to)}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          border: '1px solid #333', color: '#666', fontSize: 9,
          padding: '1px 5px', borderRadius: 2,
        }}>
          #{entry.sessionId || '—'}
        </span>
      </div>
    </div>
  );
}

function formatChangeVal(val: string | null): string {
  if (val === null || val === '') return '(empty)';
  return String(val)
    .replace(/_/g, '-')
    .toLowerCase();
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  color: '#00e676',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '3px 8px',
  outline: 'none',
  letterSpacing: 1,
};
