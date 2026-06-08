import { useEffect, useState } from 'react';
import {
  EnvelopeIcon, CircleStackIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { smtpTest, downloadBackup, listBackups, type BackupFile } from '../api/admin';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Admin() {
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpResult, setSmtpResult] = useState<'ok' | 'fail' | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);

  useEffect(() => {
    listBackups()
      .then(setBackups)
      .catch(() => {})
      .finally(() => setBackupsLoading(false));
  }, []);

  async function handleSmtpTest() {
    setSmtpLoading(true);
    setSmtpResult(null);
    try {
      await smtpTest();
      setSmtpResult('ok');
      toast.success('Test email sent successfully.');
    } catch {
      setSmtpResult('fail');
      toast.error('SMTP test failed. Check server logs.');
    } finally {
      setSmtpLoading(false);
    }
  }

  async function handleBackup() {
    setBackupLoading(true);
    try {
      await downloadBackup();
      toast.success('Backup downloaded.');
      const fresh = await listBackups();
      setBackups(fresh);
    } catch {
      toast.error('Backup failed.');
    } finally {
      setBackupLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">System Administration</h1>
        <p className="text-gray-500 text-sm mt-1">SMTP configuration, database backups, and system health</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMTP Test */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-50 p-2.5 rounded-xl">
              <EnvelopeIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Email (SMTP) Configuration</h3>
              <p className="text-xs text-gray-500 mt-0.5">Send a test email to verify the SMTP connection</p>
            </div>
          </div>

          {smtpResult === 'ok' && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-2.5 mb-4 text-sm">
              <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
              Test email sent to your account. Check your inbox.
            </div>
          )}
          {smtpResult === 'fail' && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-xl px-4 py-2.5 mb-4 text-sm">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
              SMTP test failed. Verify SMTP credentials in .env and restart the server.
            </div>
          )}

          <button
            onClick={handleSmtpTest}
            disabled={smtpLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {smtpLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : <EnvelopeIcon className="w-4 h-4" />}
            Send Test Email
          </button>

          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Required .env variables</p>
            <ul className="text-xs text-gray-500 space-y-0.5 font-mono">
              <li>SMTP_HOST</li>
              <li>SMTP_PORT</li>
              <li>SMTP_USER</li>
              <li>SMTP_PASS</li>
              <li>SMTP_FROM</li>
              <li>ALERT_EMAIL_TO</li>
            </ul>
          </div>
        </div>

        {/* Database Backup */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-50 p-2.5 rounded-xl">
              <CircleStackIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Database Backup</h3>
              <p className="text-xs text-gray-500 mt-0.5">Backups run automatically at 23:00 daily</p>
            </div>
          </div>

          <button
            onClick={handleBackup}
            disabled={backupLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 mb-5"
          >
            {backupLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : <ArrowDownTrayIcon className="w-4 h-4" />}
            Create & Download Backup Now
          </button>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Available Backups ({backups.length})</p>
            {backupsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-400 border-t-transparent mx-auto" />
              </div>
            ) : backups.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">No backups yet. Run one above.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {backups.map((b) => (
                  <div key={b.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-700 font-mono">{b.name}</p>
                      <p className="text-xs text-gray-400">{format(new Date(b.createdAt), 'dd MMM yyyy HH:mm')}</p>
                    </div>
                    <span className="text-xs text-gray-500">{fmtBytes(b.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp config info */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-6">
        <h3 className="font-semibold text-green-800 mb-3">WhatsApp Alert Configuration (Optional)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-green-700">
          <div>
            <p className="font-mono text-xs font-semibold mb-1">Required .env variables:</p>
            <ul className="text-xs font-mono space-y-0.5">
              <li>TWILIO_ACCOUNT_SID</li>
              <li>TWILIO_AUTH_TOKEN</li>
              <li>TWILIO_WHATSAPP_FROM</li>
              <li>WHATSAPP_ALERT_TO</li>
            </ul>
          </div>
          <div className="text-xs">
            <p className="font-semibold mb-1">Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>WhatsApp alerts are sent alongside email alerts</li>
              <li>WHATSAPP_ALERT_TO accepts comma-separated numbers (e.g. +233501234567,+233241234567)</li>
              <li>Requires a Twilio WhatsApp-enabled number</li>
              <li>Gracefully skipped if not configured</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
