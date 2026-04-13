import React from 'react';

const STATUS_MAP = {
  // 7-state workflow
  ARRIVED_AT_BOOTH:       { label: 'At Booth',         cls: 'badge-arrived_at_booth' },
  PENDING_BAY_ASSIGNMENT: { label: 'Pending Bay',      cls: 'badge-pending_bay_assignment' },
  BAY_ASSIGNED:           { label: 'Bay Assigned',     cls: 'badge-bay_assigned' },
  ARRIVED_AT_BAY:         { label: 'At Bay',           cls: 'badge-arrived_at_bay' },
  UNDER_EXAMINATION:      { label: 'Under Exam',       cls: 'badge-under_examination' },
  EXAMINATION_COMPLETED:  { label: 'Exam Done',        cls: 'badge-examination_completed' },
  EXITED:                 { label: 'Exited',           cls: 'badge-exited' },
  CANCELLED:              { label: 'Cancelled',        cls: 'badge-cancelled' },
  OVERSTAYED:             { label: 'Overstayed',       cls: 'badge-overstayed' },
  // Legacy aliases
  PENDING:                { label: 'Pending',          cls: 'badge-pending' },
  IN_HOLDING_AREA:        { label: 'In Holding Area',  cls: 'badge-in_holding' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status || '—', cls: 'badge-cancelled' };
  return <span className={cls}>{label}</span>;
}
