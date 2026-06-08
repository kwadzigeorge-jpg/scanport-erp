const fs   = require('fs');
const path = require('path');
const { testSmtp }  = require('../services/emailService');
const { runBackup, BACKUP_DIR } = require('../jobs/backupJob');
const { audit, ACTIONS } = require('../services/auditService');

async function smtpTest(req, res, next) {
  try {
    const to = req.body.email || req.user.email;
    const result = await testSmtp(to);
    await audit(req.user, ACTIONS.SMTP_TEST, 'Admin', 'smtp', `Test sent to ${to}`);
    res.json({ message: `Test email sent to ${to}`, ...result });
  } catch (err) {
    res.status(500).json({ error: `SMTP test failed: ${err.message}` });
  }
}

async function downloadBackup(req, res, next) {
  try {
    const dest = runBackup();
    if (!dest) return res.status(404).json({ error: 'No SQLite database found (PostgreSQL mode).' });

    await audit(req.user, ACTIONS.BACKUP_DOWNLOAD, 'Admin', 'backup', path.basename(dest));
    res.download(dest, path.basename(dest));
  } catch (err) { next(err); }
}

async function listBackups(req, res, next) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .sort()
      .reverse()
      .map((f) => ({
        name: f,
        size: fs.statSync(path.join(BACKUP_DIR, f)).size,
        createdAt: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
      }));
    res.json(files);
  } catch (err) { next(err); }
}

module.exports = { smtpTest, downloadBackup, listBackups };
