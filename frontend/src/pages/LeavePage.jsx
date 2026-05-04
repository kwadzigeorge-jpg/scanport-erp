import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldOff } from 'lucide-react';

export default function LeavePage() {
  const { hasRole } = useAuth();

  if (!hasRole('admin') && !hasRole('supervisor')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <ShieldOff size={48} className="text-gray-300" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">Leave Management is only available to Supervisors and Admins.</p>
      </div>
    );
  }

  return (
    <iframe
      src="/leave.html"
      title="Leave Management System"
      style={{ width: '100%', height: 'calc(100vh - 57px)', border: 'none', display: 'block' }}
    />
  );
}
