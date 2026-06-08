require('dotenv').config();
const nodemailer = require('nodemailer');
const { format } = require('date-fns');

function buildTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail(to, subject, html) {
  const transporter = buildTransporter();
  if (!transporter || !to) {
    console.log('[Email skipped – SMTP not configured]', subject);
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'ScanPort <noreply@scanport.com>',
      to,
      subject,
      html,
    });
    console.log(`[Email sent] ${subject} → ${to} (${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email error]', err.message);
    throw err;
  }
}

async function testSmtp(toAddress) {
  const result = await sendEmail(
    toAddress,
    '[ScanPort] SMTP Test – Connection Successful',
    `<h2 style="color:#1e3a5f">ScanPort – SMTP Test</h2>
     <p>This is a test email confirming your SMTP configuration is working correctly.</p>
     <p>Sent: ${new Date().toISOString()}</p>`
  );
  return result;
}

function certRow(scanner, cert, daysToExpiry) {
  return `
    <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px">
      <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:40%">Scanner Serial</td><td style="padding:8px">${scanner.serialNumber}</td></tr>
      <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Accelerator Serial</td><td style="padding:8px">${scanner.acceleratorSerial}</td></tr>
      <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Location</td><td style="padding:8px">${scanner.location || '—'}</td></tr>
      <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Expiry Date</td><td style="padding:8px">${format(new Date(cert.expiryDate), 'dd MMM yyyy')}</td></tr>
      <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Days to Expiry</td><td style="padding:8px"><strong style="color:${daysToExpiry <= 30 ? '#dc2626' : '#d97706'}">${daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry}</strong></td></tr>
    </table>`;
}

function wrap(title, color, body) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${color};padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:white;margin:0;font-size:18px">${title}</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">ScanPort – Port Scanner Certification System</p>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        ${body}
        <p style="margin-top:24px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px">
          This is an automated alert from ScanPort. Log in to take action.
        </p>
      </div>
    </div>`;
}

async function sendNoticeDueAlert(scanner, cert, daysToExpiry) {
  return sendEmail(
    process.env.ALERT_EMAIL,
    `[ACTION REQUIRED] NRA Notice Due – Scanner ${scanner.serialNumber}`,
    wrap('#d97706', '#d97706',
      `<p>Scanner <strong>${scanner.serialNumber}</strong> has reached its 4-month notice window.
       Please prepare and send the renewal notice to the NRA <strong>immediately</strong>.</p>
       ${certRow(scanner, cert, daysToExpiry)}`)
  );
}

async function sendExpiryWarning(scanner, cert, daysToExpiry) {
  return sendEmail(
    process.env.ALERT_EMAIL,
    `[URGENT] Scanner Expiry in ${daysToExpiry} days – ${scanner.serialNumber}`,
    wrap('#dc2626', '#dc2626',
      `<p>Scanner <strong>${scanner.serialNumber}</strong> expires in <strong>${daysToExpiry} days</strong>.</p>
       ${certRow(scanner, cert, daysToExpiry)}`)
  );
}

async function sendExpiredAlert(scanner, cert) {
  return sendEmail(
    process.env.ALERT_EMAIL,
    `[CRITICAL] Scanner Certification EXPIRED – ${scanner.serialNumber}`,
    wrap('#7f1d1d', '#7f1d1d',
      `<p>Scanner <strong>${scanner.serialNumber}</strong> certification has <strong>EXPIRED</strong>.</p>
       ${certRow(scanner, cert, -1)}`)
  );
}

module.exports = { sendNoticeDueAlert, sendExpiryWarning, sendExpiredAlert, testSmtp };
