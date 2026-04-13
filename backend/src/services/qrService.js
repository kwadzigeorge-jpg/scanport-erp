const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

/**
 * Generate a signed QR token for a transaction.
 * The QR code embeds a verification URL with a signed JWT payload.
 */
function generateQRToken(transactionId, containerNumber) {
  // Short-lived signed token embedded in QR
  return jwt.sign(
    { txn: transactionId, ctr: containerNumber },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Generate QR code as a data URL (base64 PNG).
 */
async function generateQRDataURL(transactionId, containerNumber) {
  const token = generateQRToken(transactionId, containerNumber);
  const verifyUrl = `${process.env.QR_CODE_BASE_URL || 'http://localhost:5000'}/api/containers/verify/${token}`;

  const dataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    width: 256,
  });

  return { dataUrl, token, verifyUrl };
}

/**
 * Verify a scanned QR token.
 */
function verifyQRToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { generateQRDataURL, verifyQRToken, generateQRToken };
