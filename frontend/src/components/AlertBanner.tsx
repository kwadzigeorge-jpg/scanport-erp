import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import type { AlertLog } from '../types';
import { resolveAlert } from '../api/notifications';
import toast from 'react-hot-toast';

export default function AlertBanner({ alerts, onDismiss }: { alerts: AlertLog[]; onDismiss: () => void }) {
  if (!alerts.length) return null;

  const type = alerts[0].type;
  const color =
    type === 'EXPIRED' ? 'bg-red-50 border-red-300 text-red-800' :
    type === 'NOTICE_DUE' ? 'bg-orange-50 border-orange-300 text-orange-800' :
    'bg-yellow-50 border-yellow-300 text-yellow-800';

  async function dismiss(id: string) {
    try {
      await resolveAlert(id);
      onDismiss();
    } catch {
      toast.error('Could not dismiss alert.');
    }
  }

  return (
    <div className={`rounded-xl border p-4 mb-6 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold">Active Alerts ({alerts.length})</span>
      </div>
      <ul className="space-y-1">
        {alerts.slice(0, 5).map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
            <span>{a.message}</span>
            <button onClick={() => dismiss(a.id)} className="ml-2 flex-shrink-0 hover:opacity-70">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      {alerts.length > 5 && (
        <p className="text-xs mt-2 opacity-70">+{alerts.length - 5} more alerts. See Notifications page.</p>
      )}
    </div>
  );
}
