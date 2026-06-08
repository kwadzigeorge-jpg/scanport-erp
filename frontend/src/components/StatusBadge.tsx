const CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:       { label: 'Active',               cls: 'bg-green-100 text-green-800 border border-green-300'   },
  NOTICE_DUE:   { label: 'Notice Due',            cls: 'bg-orange-100 text-orange-800 border border-orange-300' },
  NOTICE_SENT:  { label: 'Notice Sent',           cls: 'bg-blue-100 text-blue-800 border border-blue-300'     },
  EXPIRED:      { label: 'Expired',               cls: 'bg-red-100 text-red-800 border border-red-300'        },
  PENDING:      { label: 'Awaiting Certification',cls: 'bg-purple-100 text-purple-800 border border-purple-300'},
};

export default function StatusBadge({ status }: { status: string }) {
  const { label, cls } = CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
