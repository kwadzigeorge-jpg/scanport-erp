const crypto = require('crypto');

/**
 * Generate a human-readable transaction ID: TXN-YYYYMMDD-NNNN
 */
async function generateTransactionId(db) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM container_transactions
     WHERE transaction_id LIKE $1`,
    [`TXN-${dateStr}-%`]
  );
  const seq = (parseInt(rows[0].cnt) + 1).toString().padStart(4, '0');
  return `TXN-${dateStr}-${seq}`;
}

/**
 * Generate a cryptographically random QR token
 */
function generateQRToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate duration in minutes between two Date objects
 */
function calcDwellMinutes(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  return Math.round((new Date(timeOut) - new Date(timeIn)) / 60000);
}

/**
 * Format minutes as "Xh Ym"
 */
function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Mask sensitive data in logs
 */
function maskPhone(phone) {
  if (!phone || phone.length < 4) return '***';
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

module.exports = { generateTransactionId, generateQRToken, calcDwellMinutes, formatDuration, maskPhone };
