const db = require('../config/database');
const XLSX = require('xlsx');
const { format: csvFormat } = require('@fast-csv/format');

function toCSV(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = csvFormat({ headers: true });
  stream.pipe(res);
  rows.forEach(r => stream.write(r));
  stream.end();
}

function toXLSX(res, filename, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

// ─── Daily Operations Report ──────────────────────────────────────────────────
async function dailyReport(req, res, next) {
  try {
    const { date = new Date().toISOString().slice(0, 10), format = 'json' } = req.query;
    const { rows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.agent_name, ct.agent_phone,
             ct.truck_number, ct.status, ct.created_at, ct.time_in, ct.time_out,
             ct.dwell_minutes, ha.name AS area, b.bay_code,
             ub.username AS booth_officer, um.username AS entry_marshal,
             ux.username AS exit_marshal
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      LEFT JOIN users ub ON ub.id=ct.created_by
      LEFT JOIN users um ON um.id=ct.confirmed_entry_by
      LEFT JOIN users ux ON ux.id=ct.confirmed_exit_by
      WHERE DATE(ct.created_at) = $1
      ORDER BY ct.created_at
    `, [date]);

    if (format === 'csv')  return toCSV(res, `daily-report-${date}.csv`, rows);
    if (format === 'xlsx') return toXLSX(res, `daily-report-${date}.xlsx`, rows);
    return res.json({ date, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Dwell Time Report ────────────────────────────────────────────────────────
async function dwellTimeReport(req, res, next) {
  try {
    const { from, to, format = 'json' } = req.query;
    const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const { rows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.agent_name,
             ha.name AS area, b.bay_code,
             ct.time_in, ct.time_out, ct.dwell_minutes,
             CASE
               WHEN ct.dwell_minutes < 60   THEN '< 1 hour'
               WHEN ct.dwell_minutes <= 180  THEN '1-3 hours'
               ELSE '> 3 hours'
             END AS dwell_category
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status='EXITED'
        AND DATE(ct.time_in) BETWEEN $1 AND $2
      ORDER BY ct.dwell_minutes DESC
    `, [fromDate, toDate]);

    if (format === 'csv')  return toCSV(res, `dwell-time-${fromDate}-${toDate}.csv`, rows);
    if (format === 'xlsx') return toXLSX(res, `dwell-time-${fromDate}-${toDate}.xlsx`, rows);
    return res.json({ from: fromDate, to: toDate, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Agent Performance Report ─────────────────────────────────────────────────
async function agentPerformanceReport(req, res, next) {
  try {
    const { from, to, format = 'json' } = req.query;
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const { rows } = await db.query(`
      SELECT ct.agent_name, ct.agent_phone,
             COUNT(*) AS total_allocations,
             COUNT(*) FILTER (WHERE ct.status='EXITED') AS completed,
             COUNT(*) FILTER (WHERE ct.status='IN_HOLDING_AREA') AS still_in,
             COUNT(*) FILTER (WHERE ct.status='CANCELLED') AS cancelled,
             ROUND(AVG(ct.dwell_minutes) FILTER (WHERE ct.status='EXITED'), 1) AS avg_dwell_minutes,
             MAX(ct.dwell_minutes) FILTER (WHERE ct.status='EXITED') AS max_dwell_minutes
      FROM container_transactions ct
      WHERE DATE(ct.created_at) BETWEEN $1 AND $2
      GROUP BY ct.agent_name, ct.agent_phone
      ORDER BY total_allocations DESC
    `, [fromDate, toDate]);

    if (format === 'csv')  return toCSV(res, `agent-performance-${fromDate}-${toDate}.csv`, rows);
    if (format === 'xlsx') return toXLSX(res, `agent-performance-${fromDate}-${toDate}.xlsx`, rows);
    return res.json({ from: fromDate, to: toDate, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────
async function auditTrail(req, res, next) {
  try {
    const { user, action, from, to, page = 1, limit = 50, format = 'json' } = req.query;
    const conditions = [];
    const params = [];

    if (user)   { params.push(`%${user}%`); conditions.push(`(al.username ILIKE $${params.length})`); }
    if (action) { params.push(`%${action}%`); conditions.push(`al.action ILIKE $${params.length}`); }
    if (from)   { params.push(from); conditions.push(`DATE(al.created_at) >= $${params.length}`); }
    if (to)     { params.push(to);   conditions.push(`DATE(al.created_at) <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT al.id, al.username, al.role, al.action, al.entity, al.entity_id,
              al.details, al.ip_address, al.created_at
       FROM audit_logs al ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    if (format === 'csv')  return toCSV(res, `audit-trail.csv`, rows.map(r => ({ ...r, details: JSON.stringify(r.details) })));
    if (format === 'xlsx') return toXLSX(res, `audit-trail.xlsx`, rows.map(r => ({ ...r, details: JSON.stringify(r.details) })));

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: parseInt(page), limit: parseInt(limit), rows });
  } catch (err) { next(err); }
}

// ─── Exception Report (overstayed / missing exits) ───────────────────────────
async function exceptionReport(req, res, next) {
  try {
    const { rows: cfg } = await db.query("SELECT value FROM system_config WHERE key='overstay_threshold_hours'");
    const threshold = parseFloat(cfg[0]?.value || 3);
    const { format = 'json' } = req.query;

    const { rows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.agent_name, ct.agent_phone,
             ha.name AS area, b.bay_code, ct.time_in,
             ROUND(EXTRACT(EPOCH FROM (NOW()-ct.time_in))/3600, 2) AS hours_in_holding,
             'OVERSTAYED' AS exception_type
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status='IN_HOLDING_AREA'
        AND EXTRACT(EPOCH FROM (NOW()-ct.time_in))/3600 > $1
      ORDER BY ct.time_in ASC
    `, [threshold]);

    if (format === 'csv')  return toCSV(res, 'exception-report.csv', rows);
    if (format === 'xlsx') return toXLSX(res, 'exception-report.xlsx', rows);
    return res.json({ threshold_hours: threshold, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── System Config (Admin) ────────────────────────────────────────────────────
async function getSystemConfig(req, res, next) {
  try {
    const { rows } = await db.query('SELECT key, value, description FROM system_config ORDER BY key');
    return res.json(rows);
  } catch (err) { next(err); }
}

async function updateSystemConfig(req, res, next) {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value are required.' });
    await db.query(
      `INSERT INTO system_config (key, value, updated_by, updated_at) VALUES ($1,$2,$3,NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=NOW()`,
      [key, String(value), req.user.id]
    );
    const { logAudit } = require('../middleware/audit');
    await logAudit(req, 'config:updated', 'system_config', key, { key, value });
    return res.json({ message: 'Config updated.' });
  } catch (err) { next(err); }
}

module.exports = { dailyReport, dwellTimeReport, agentPerformanceReport, auditTrail, exceptionReport, getSystemConfig, updateSystemConfig };
