import { useState, useEffect, useRef } from 'react';
import type { BoardEntry } from '../../api/scannerBoard';
import { SCANNER_LABELS, STATUS_META, FAULT_LABELS } from './index';

interface Props {
  entry:     BoardEntry;
  focusCell: 'fault' | 'remarks' | 'asset';
  date:      string;
  shift:     string;
  onSave:    (scanner: string, data: Partial<BoardEntry>) => Promise<void>;
  onClose:   () => void;
}

const S = {
  bg:      '#0d0d0d',
  card:    '#111',
  border:  '#1e1e1e',
  border2: '#2a2a2a',
  text:    '#ccc',
  dim:     '#555',
  green:   '#00e676',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: `1px solid ${S.border2}`,
  color: S.green,
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 12,
  padding: '6px 10px',
  outline: 'none',
  letterSpacing: 1,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: S.dim,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  marginBottom: 5,
  display: 'block',
};

export default function EditModal({ entry, focusCell, date, shift, onSave, onClose }: Props) {
  const [status,       setStatus]       = useState(entry.status       || 'OPERATIONAL');
  const [faultType,    setFaultType]    = useState(entry.faultType    || 'NO_ISSUES');
  const [faultNote,    setFaultNote]    = useState(entry.faultNote    || '');
  const [scanCount,    setScanCount]    = useState(String(entry.scanCount ?? 0));
  const [updateRemark, setUpdateRemark] = useState(entry.updateRemark || '');
  const [saving,       setSaving]       = useState(false);

  const faultRef   = useRef<HTMLSelectElement>(null);
  const remarkRef  = useRef<HTMLTextAreaElement>(null);
  const countRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusCell === 'fault')   faultRef.current?.focus();
    if (focusCell === 'remarks') remarkRef.current?.focus();
    if (focusCell === 'asset')   countRef.current?.focus();
  }, [focusCell]);

  async function handleSave() {
    setSaving(true);
    await onSave(entry.scanner, {
      status,
      faultType:    faultType    || null,
      faultNote:    faultNote    || null,
      scanCount:    Number(scanCount) || 0,
      updateRemark: updateRemark || null,
    });
    setSaving(false);
  }

  const currentMeta = STATUS_META[status] || STATUS_META.OPERATIONAL;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: S.card,
        border: `1px solid ${currentMeta.border}`,
        borderRadius: 4,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: `0 0 40px ${currentMeta.color}22`,
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: currentMeta.color, fontSize: 14, fontWeight: 'bold', letterSpacing: 3 }}>
              [ {SCANNER_LABELS[entry.scanner] || entry.scanner} ]
            </div>
            <div style={{ color: S.dim, fontSize: 10, marginTop: 3, letterSpacing: 1 }}>
              {date} &nbsp;// {shift}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: S.dim, fontSize: 18, cursor: 'pointer',
              fontFamily: 'monospace', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '18px 18px 6px' }}>

          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>// STATUS</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  style={{
                    flex: '1 1 90px',
                    background:   status === key ? meta.bg      : 'transparent',
                    border:       `1px solid ${status === key ? meta.border : S.border2}`,
                    color:        status === key ? meta.color   : S.dim,
                    fontSize:     9,
                    padding:      '6px 8px',
                    cursor:       'pointer',
                    fontFamily:   'monospace',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    transition:   'all .15s',
                    borderRadius: 2,
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scan Count */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>// SCAN COUNT</label>
            <input
              ref={countRef}
              type="number"
              min={0}
              value={scanCount}
              onChange={e => setScanCount(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </div>

          {/* Fault Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>// FAULT TYPE</label>
            <select
              ref={faultRef}
              value={faultType}
              onChange={e => setFaultType(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {Object.entries(FAULT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Fault Note */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>// FAULT NOTE &nbsp;<span style={{ color: '#333' }}>(additional description)</span></label>
            <textarea
              value={faultNote}
              onChange={e => setFaultNote(e.target.value)}
              rows={3}
              placeholder="describe the fault in detail..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Update / Remarks */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>// UPDATE / REMARKS</label>
            <textarea
              ref={remarkRef}
              value={updateRemark}
              onChange={e => setUpdateRemark(e.target.value)}
              rows={3}
              placeholder="update remarks, actions taken, estimated resolution..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px 16px',
          borderTop: `1px solid ${S.border}`,
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'transparent',
              border: `1px solid ${S.border2}`,
              color: S.dim,
              fontSize: 11,
              padding: '7px 18px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}
          >
            [ CANCEL ]
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? 'rgba(0,230,118,0.08)' : 'rgba(0,230,118,0.12)',
              border: `1px solid ${S.green}`,
              color: S.green,
              fontSize: 11,
              padding: '7px 22px',
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'monospace',
              letterSpacing: 1,
              fontWeight: 'bold',
            }}
          >
            {saving ? '[ SAVING... ]' : '[ SAVE ]'}
          </button>
        </div>
      </div>
    </div>
  );
}
