const cron  = require('node-cron');
const fs    = require('fs');
const path  = require('path');

const DB_PATH     = path.join(__dirname, '../../prisma/dev.db');
const BACKUP_DIR  = path.join(__dirname, '../../backups');
const RETAIN_DAYS = parseInt(process.env.BACKUP_RETAIN_DAYS || '30', 10);

function runBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('[Backup] SQLite DB not found – skipping (PostgreSQL mode?)');
      return null;
    }
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `scanport-${ts}.db`);
    fs.copyFileSync(DB_PATH, dest);
    console.log(`[Backup] Saved → ${path.basename(dest)}`);

    // Prune old backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .sort()
      .reverse();

    files.slice(RETAIN_DAYS).forEach((f) => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`[Backup] Pruned old backup: ${f}`);
    });

    return dest;
  } catch (err) {
    console.error('[Backup error]', err.message);
    return null;
  }
}

function startBackupJob() {
  // Daily at 23:00
  cron.schedule('0 23 * * *', () => { runBackup(); });
  console.log('[Cron] Database backup scheduled at 23:00 every day.');
}

module.exports = { startBackupJob, runBackup, BACKUP_DIR };
