import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';

export default function ChitPrintView({ transaction, onClose }) {
  const printRef = useRef();
  const handlePrint = useReactToPrint({ content: () => printRef.current });

  if (!transaction) return null;

  const verifyUrl = `/api/containers/verify/${transaction.qr_code_token}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-b no-print">
          <h2 className="font-semibold text-gray-900">Digital Chit</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="btn-primary text-sm">
              <Printer size={15} /> Print
            </button>
            <button onClick={onClose} className="btn-secondary text-sm">Close</button>
          </div>
        </div>

        {/* Printable Chit */}
        <div ref={printRef} className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-dashed border-gray-300">
            <img src="/logo.png" alt="ScanPort" className="h-12 w-12 object-contain" />
            <div>
              <p className="font-bold text-gray-900 text-base tracking-wide">SCANPORT</p>
              <p className="text-xs text-gray-500 font-medium">Holding Area Admission Chit</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-3 border-2 border-gray-200 rounded-xl">
              <QRCodeSVG value={verifyUrl} size={160} level="H" />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2 text-sm">
            <ChitField label="Transaction ID"   value={transaction.transaction_id} mono />
            <ChitField label="Container No."    value={transaction.container_number} mono bold />
            <ChitField label="Holding Area"     value={`${transaction.area_name || '—'} · Bay ${transaction.bay_code || '—'}`} />
            <ChitField label="Agent Name"       value={transaction.agent_name} />
            <ChitField label="Agent Phone"      value={transaction.agent_phone} />
            {transaction.truck_number && <ChitField label="Truck Number" value={transaction.truck_number} />}
            <ChitField label="Issued At"        value={format(new Date(transaction.created_at), 'dd MMM yyyy, HH:mm')} />
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
            <p className="text-xs text-gray-400 text-center">
              Scan QR code to verify at gate · {transaction.transaction_id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChitField({ label, value, mono, bold }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right font-medium text-gray-900 ${mono ? 'font-mono' : ''} ${bold ? 'text-base' : ''}`}>
        {value}
      </span>
    </div>
  );
}
