require('dotenv').config();
const { format } = require('date-fns');

function getClient() {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) return null;
  try {
    return require('twilio')(sid, auth);
  } catch {
    console.warn('[WhatsApp] twilio package not installed. Run: npm install twilio');
    return null;
  }
}

async function sendWhatsApp(body) {
  const client = getClient();
  const from   = process.env.TWILIO_WHATSAPP_FROM;
  const targets = (process.env.WHATSAPP_ALERT_TO || '')
    .split(',').map((n) => n.trim()).filter(Boolean);

  if (!client || !targets.length) {
    console.log('[WhatsApp skipped – not configured]', body.slice(0, 80));
    return;
  }

  for (const number of targets) {
    try {
      await client.messages.create({
        from,
        to: number.startsWith('whatsapp:') ? number : `whatsapp:${number}`,
        body,
      });
      console.log(`[WhatsApp sent] → ${number}`);
    } catch (err) {
      console.error(`[WhatsApp error] ${number}:`, err.message);
    }
  }
}

async function sendNoticeDueWhatsApp(scanner, cert, daysToExpiry) {
  await sendWhatsApp(
    `⚠️ *ScanPort Alert – Action Required*\n\n` +
    `Scanner *${scanner.serialNumber}* NRA renewal notice is DUE.\n` +
    `📅 Expiry: *${format(new Date(cert.expiryDate), 'dd MMM yyyy')}* (${daysToExpiry} days)\n` +
    `📍 Location: ${scanner.location || 'Not set'}\n\n` +
    `Please prepare and send the NRA notification immediately.`
  );
}

async function sendExpiryWarningWhatsApp(scanner, cert, daysToExpiry) {
  await sendWhatsApp(
    `🚨 *ScanPort – Urgent Expiry Warning*\n\n` +
    `Scanner *${scanner.serialNumber}* expires in *${daysToExpiry} days*.\n` +
    `📅 Expiry: ${format(new Date(cert.expiryDate), 'dd MMM yyyy')}\n` +
    `📍 Location: ${scanner.location || 'Not set'}\n\n` +
    `Immediate action required.`
  );
}

async function sendExpiredWhatsApp(scanner, cert) {
  await sendWhatsApp(
    `🔴 *ScanPort – CERTIFICATION EXPIRED*\n\n` +
    `Scanner *${scanner.serialNumber}* certification has EXPIRED.\n` +
    `📅 Expired: ${format(new Date(cert.expiryDate), 'dd MMM yyyy')}\n` +
    `📍 Location: ${scanner.location || 'Not set'}\n\n` +
    `Urgent renewal required.`
  );
}

module.exports = { sendNoticeDueWhatsApp, sendExpiryWarningWhatsApp, sendExpiredWhatsApp };
