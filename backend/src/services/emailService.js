const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmail({ to, subject, html }) {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — skipping');
    return { skipped: true };
  }
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  if (!recipients) return { skipped: true };
  return transporter.sendMail({
    from: process.env.SMTP_FROM || `ScanPort ERP <${process.env.SMTP_USER}>`,
    to: recipients,
    subject,
    html,
  });
}

async function verifyConnection() {
  if (!isConfigured()) return { ok: false, reason: 'SMTP_HOST, SMTP_USER, and SMTP_PASS are not set in .env' };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendEmail, verifyConnection, isConfigured };
