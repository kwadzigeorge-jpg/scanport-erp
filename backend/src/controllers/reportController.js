const db = require('../config/database');
const XLSX = require('xlsx');
const { format: csvFormat } = require('@fast-csv/format');

const ACTIVE_STATUSES = [
  'ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED',
  'ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED',
];

function toCSV(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = csvFormat({ headers: true });
  stream.pipe(res);
  rows.forEach(r => stream.write(r));
  stream.end();
}

function toXLSX(res, filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  });
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

async function getSlaMinutes() {
  const { rows } = await db.query("SELECT value FROM system_config WHERE key='overstay_threshold_hours'");
  return parseFloat(rows[0]?.value || 3) * 60;
}

// ─── Operations Dashboard ────────────────────────────────────────────────────
async function operationsDashboard(req, res, next) {
  try {
    const slaMinutes = await getSlaMinutes();
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to   = req.query.to   || today;

    // Active containers with live dwell (always current state, no date filter)
    const { rows: active } = await db.query(`
      SELECT ct.id, ct.transaction_id, ct.container_number, ct.waybill_number,
             ct.agent_name, ct.truck_number, ct.status,
             ha.name AS area_name, ha.code AS area_code, b.bay_code,
             COALESCE(ct.time_in, ct.arrival_time, ct.created_at) AS start_time,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int AS live_dwell_minutes
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
      LEFT JOIN bays b ON b.id = ct.bay_id
      WHERE ct.status = ANY($1)
      ORDER BY live_dwell_minutes DESC
    `, [ACTIVE_STATUSES]);

    // Released in the selected date range
    const { rows: releasedToday } = await db.query(`
      SELECT COUNT(*)::int AS count,
             ROUND(AVG(dwell_minutes))::int AS avg_dwell
      FROM container_transactions
      WHERE status='EXITED' AND DATE(time_out) BETWEEN $1 AND $2
    `, [from, to]);

    // Total bays
    const { rows: bays } = await db.query(`SELECT COUNT(*)::int AS total FROM bays WHERE is_active=TRUE`);

    const breaches = active.filter(r => r.live_dwell_minutes > slaMinutes);
    const longest = active[0] || null;

    return res.json({
      sla_minutes: slaMinutes,
      from, to,
      kpi: {
        containers_in_holding: active.length,
        avg_dwell_active: active.length
          ? Math.round(active.reduce((s, r) => s + r.live_dwell_minutes, 0) / active.length)
          : 0,
        active_breaches: breaches.length,
        longest_dwell_minutes: longest?.live_dwell_minutes || 0,
        longest_container: longest?.container_number || null,
        longest_area: longest?.area_name || null,
        throughput_today: releasedToday[0]?.count || 0,
        avg_dwell_today: releasedToday[0]?.avg_dwell || 0,
        total_bays: bays[0]?.total || 0,
        occupied_bays: active.length,
        utilisation_pct: bays[0]?.total
          ? Math.round((active.length / bays[0].total) * 100)
          : 0,
      },
      active_containers: active,
    });
  } catch (err) { next(err); }
}

// ─── Dwell Time Analysis ─────────────────────────────────────────────────────
async function dwellAnalysis(req, res, next) {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const slaMinutes = await getSlaMinutes();

    const { rows: hourly } = await db.query(`
      SELECT EXTRACT(HOUR FROM COALESCE(time_in, created_at))::int AS hour,
             ROUND(AVG(dwell_minutes))::int AS avg_dwell,
             COUNT(*)::int AS count
      FROM container_transactions
      WHERE status='EXITED'
        AND DATE(COALESCE(time_in, created_at)) BETWEEN $1 AND $2
      GROUP BY 1 ORDER BY 1
    `, [fromDate, toDate]);

    const { rows: dist } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE dwell_minutes <= 30)::int           AS bucket_0_30,
        COUNT(*) FILTER (WHERE dwell_minutes BETWEEN 31 AND 60)::int  AS bucket_31_60,
        COUNT(*) FILTER (WHERE dwell_minutes BETWEEN 61 AND 120)::int AS bucket_61_120,
        COUNT(*) FILTER (WHERE dwell_minutes > 120)::int           AS bucket_120_plus,
        COUNT(*)::int AS total
      FROM container_transactions
      WHERE status='EXITED'
        AND DATE(COALESCE(time_in, created_at)) BETWEEN $1 AND $2
    `, [fromDate, toDate]);

    const { rows: detail } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.agent_name,
             ha.name AS area, b.bay_code,
             ct.time_in, ct.time_out, ct.dwell_minutes, ct.status,
             COALESCE(ct.time_in, ct.arrival_time, ct.created_at) AS start_time,
             CASE WHEN ct.status='EXITED'
               THEN ct.dwell_minutes
               ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int
             END AS effective_dwell
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE DATE(ct.created_at) BETWEEN $1 AND $2
      ORDER BY effective_dwell DESC
    `, [fromDate, toDate]);

    return res.json({ from: fromDate, to: toDate, sla_minutes: slaMinutes, hourly, distribution: dist[0], detail });
  } catch (err) { next(err); }
}

// ─── Holding Area Performance ─────────────────────────────────────────────────
async function areaPerformance(req, res, next) {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const slaMinutes = await getSlaMinutes();

    const { rows } = await db.query(`
      SELECT ha.id, ha.name, ha.code,
             COUNT(DISTINCT b.id)::int AS total_bays,
             COUNT(ct.id) FILTER (WHERE ct.status=ANY($3))::int AS active_containers,
             ROUND(AVG(
               EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60
             ) FILTER (WHERE ct.status=ANY($3)))::int AS avg_active_dwell,
             MAX(
               EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60
             ) FILTER (WHERE ct.status=ANY($3))::int AS max_active_dwell,
             COUNT(ct.id) FILTER (
               WHERE ct.status=ANY($3)
               AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 > $4
             )::int AS active_breaches,
             COUNT(ct.id) FILTER (
               WHERE ct.status='EXITED' AND ct.dwell_minutes > $4
               AND DATE(ct.time_out) BETWEEN $1 AND $2
             )::int AS historical_breaches,
             COUNT(ct.id) FILTER (WHERE DATE(ct.created_at) BETWEEN $1 AND $2)::int AS total_period
      FROM holding_areas ha
      LEFT JOIN bays b ON b.holding_area_id=ha.id AND b.is_active=TRUE
      LEFT JOIN container_transactions ct ON ct.holding_area_id=ha.id
      WHERE ha.is_active=TRUE
      GROUP BY ha.id, ha.name, ha.code
      ORDER BY active_breaches DESC, avg_active_dwell DESC NULLS LAST
    `, [fromDate, toDate, ACTIVE_STATUSES, slaMinutes]);

    return res.json({ from: fromDate, to: toDate, sla_minutes: slaMinutes, areas: rows });
  } catch (err) { next(err); }
}

// ─── Agent Performance (enhanced) ────────────────────────────────────────────
async function agentPerformanceReport(req, res, next) {
  try {
    const { from, to, format = 'json' } = req.query;
    const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const slaMinutes = await getSlaMinutes();

    const { rows } = await db.query(`
      SELECT ct.agent_name, ct.agent_phone,
             COUNT(*)::int AS total_containers,
             COUNT(*) FILTER (WHERE ct.status='EXITED')::int AS released,
             COUNT(*) FILTER (WHERE ct.status=ANY($3))::int AS active,
             COUNT(*) FILTER (WHERE ct.status='CANCELLED')::int AS cancelled,
             ROUND(AVG(ct.dwell_minutes) FILTER (WHERE ct.status='EXITED'))::int AS avg_dwell,
             MAX(ct.dwell_minutes) FILTER (WHERE ct.status='EXITED')::int AS max_dwell,
             COUNT(*) FILTER (
               WHERE ct.status='EXITED' AND ct.dwell_minutes > $4
             )::int AS released_breaches,
             COUNT(*) FILTER (
               WHERE ct.status=ANY($3)
               AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 > $4
             )::int AS active_breaches,
             MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM ct.created_at)::int) AS peak_hour
      FROM container_transactions ct
      WHERE DATE(ct.created_at) BETWEEN $1 AND $2
      GROUP BY ct.agent_name, ct.agent_phone
      ORDER BY (
        COUNT(*) FILTER (WHERE ct.status='EXITED' AND ct.dwell_minutes > $4) +
        COUNT(*) FILTER (WHERE ct.status=ANY($3) AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 > $4)
      ) DESC, COUNT(*) DESC
    `, [fromDate, toDate, ACTIVE_STATUSES, slaMinutes]);

    if (format === 'csv')  return toCSV(res, `agent-performance-${fromDate}-${toDate}.csv`, rows);
    if (format === 'xlsx') return toXLSX(res, `agent-performance-${fromDate}-${toDate}.xlsx`, [{ name: 'Agent Performance', rows }]);
    return res.json({ from: fromDate, to: toDate, sla_minutes: slaMinutes, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── SLA Exceptions ──────────────────────────────────────────────────────────
async function slaExceptions(req, res, next) {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const slaMinutes = await getSlaMinutes();

    const { rows: active } = await db.query(`
      SELECT ct.id, ct.transaction_id, ct.container_number, ct.waybill_number,
             ct.agent_name, ct.truck_number, ct.status,
             ha.name AS area_name, b.bay_code,
             COALESCE(ct.time_in, ct.arrival_time, ct.created_at) AS start_time,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int AS live_dwell_minutes,
             (ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60) - $2)::int AS minutes_over_sla,
             'ACTIVE' AS breach_status
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status=ANY($1)
        AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 > $2
      ORDER BY minutes_over_sla DESC
    `, [ACTIVE_STATUSES, slaMinutes]);

    const { rows: historical } = await db.query(`
      SELECT ct.id, ct.transaction_id, ct.container_number, ct.waybill_number,
             ct.agent_name, ct.truck_number, ct.status,
             ha.name AS area_name, b.bay_code,
             COALESCE(ct.time_in, ct.arrival_time, ct.created_at) AS start_time,
             ct.dwell_minutes AS live_dwell_minutes,
             (ct.dwell_minutes - $3)::int AS minutes_over_sla,
             'RELEASED' AS breach_status
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status='EXITED'
        AND ct.dwell_minutes > $3
        AND DATE(ct.time_out) BETWEEN $1 AND $2
      ORDER BY minutes_over_sla DESC
    `, [fromDate, toDate, slaMinutes]);

    return res.json({
      sla_minutes: slaMinutes,
      active_breaches: active.length,
      historical_breaches: historical.length,
      rows: [...active, ...historical],
    });
  } catch (err) { next(err); }
}

// ─── Multi-sheet Export ───────────────────────────────────────────────────────
async function exportReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date().toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);
    const slaMinutes = await getSlaMinutes();
    const today = new Date().toISOString().slice(0, 10);

    // Sheet 1 — Executive Summary
    const { rows: kpiRows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status=ANY($1))::int AS containers_in_holding,
        COUNT(*) FILTER (WHERE status='EXITED' AND DATE(time_out)=$2)::int AS throughput_today,
        ROUND(AVG(dwell_minutes) FILTER (WHERE status='EXITED' AND DATE(time_out)=$2))::int AS avg_dwell_today,
        COUNT(*) FILTER (WHERE status='EXITED' AND dwell_minutes > $3 AND DATE(time_out)=$2)::int AS breaches_today,
        COUNT(*)::int AS total_period
      FROM container_transactions
      WHERE DATE(created_at) BETWEEN $4 AND $5
    `, [ACTIVE_STATUSES, today, slaMinutes, fromDate, toDate]);

    const { rows: top5 } = await db.query(`
      SELECT ct.container_number, ct.agent_name, ha.name AS area,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int AS dwell_minutes,
             ct.status
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      WHERE ct.status=ANY($1)
      ORDER BY dwell_minutes DESC LIMIT 5
    `, [ACTIVE_STATUSES]);

    const summary = [{
      'Report Period': `${fromDate} to ${toDate}`,
      'Generated At': new Date().toLocaleString(),
      'Containers In Holding': kpiRows[0].containers_in_holding,
      'Throughput Today': kpiRows[0].throughput_today,
      'Avg Dwell Today (min)': kpiRows[0].avg_dwell_today,
      'SLA Breaches Today': kpiRows[0].breaches_today,
      'SLA Threshold (min)': slaMinutes,
      'SLA Compliance %': kpiRows[0].throughput_today
        ? Math.round(((kpiRows[0].throughput_today - kpiRows[0].breaches_today) / kpiRows[0].throughput_today) * 100)
        : 100,
    }, {}, { 'TOP 5 LONGEST DWELL (ACTIVE)': '' },
    ...top5.map(r => ({
      'Container': r.container_number, 'Agent': r.agent_name,
      'Area': r.area, 'Dwell (min)': r.dwell_minutes, 'Status': r.status,
    }))];

    // Sheet 2 — Active Containers
    const { rows: activeRows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.waybill_number,
             ct.agent_name, ct.truck_number, ct.status,
             ha.name AS holding_area, b.bay_code,
             COALESCE(ct.time_in, ct.arrival_time, ct.created_at) AS check_in_time,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int AS dwell_minutes,
             CASE WHEN ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60) > $2
               THEN 'BREACH' ELSE 'OK' END AS sla_status
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status=ANY($1)
      ORDER BY dwell_minutes DESC
    `, [ACTIVE_STATUSES, slaMinutes]);

    // Sheet 3 — Released History
    const { rows: releasedRows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.waybill_number,
             ct.agent_name, ct.truck_number,
             ha.name AS holding_area, b.bay_code,
             ct.time_in AS check_in, ct.time_out AS released_at,
             ct.dwell_minutes,
             CASE WHEN ct.dwell_minutes > $3 THEN 'BREACH' ELSE 'PASS' END AS sla_result,
             GREATEST(ct.dwell_minutes - $3, 0) AS minutes_over_sla
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status='EXITED'
        AND DATE(ct.time_out) BETWEEN $1 AND $2
      ORDER BY ct.time_out DESC
    `, [fromDate, toDate, slaMinutes]);

    return toXLSX(res, `scanport-report-${fromDate}-${toDate}.xlsx`, [
      { name: 'Executive Summary', rows: summary },
      { name: 'Active Containers', rows: activeRows },
      { name: 'Released History',  rows: releasedRows },
    ]);
  } catch (err) { next(err); }
}

// ─── Daily Operations Report (legacy) ────────────────────────────────────────
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
    if (format === 'xlsx') return toXLSX(res, `daily-report-${date}.xlsx`, [{ name: 'Daily Report', rows }]);
    return res.json({ date, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Dwell Time Report (legacy) ───────────────────────────────────────────────
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
    if (format === 'xlsx') return toXLSX(res, `dwell-time-${fromDate}-${toDate}.xlsx`, [{ name: 'Dwell Time', rows }]);
    return res.json({ from: fromDate, to: toDate, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────
async function auditTrail(req, res, next) {
  try {
    const { user, action, from, to, page = 1, limit = 50, format = 'json' } = req.query;
    const conditions = [];
    const params = [];

    if (user)   { params.push(`%${user}%`);   conditions.push(`al.username ILIKE $${params.length}`); }
    if (action) { params.push(`%${action}%`); conditions.push(`al.action ILIKE $${params.length}`); }
    if (from)   { params.push(from); conditions.push(`DATE(al.created_at) >= $${params.length}`); }
    if (to)     { params.push(to);   conditions.push(`DATE(al.created_at) <= $${params.length}`); }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT al.id, al.username, al.role, al.action, al.entity, al.entity_id,
              al.details, al.ip_address, al.created_at
       FROM audit_logs al ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const flat = rows.map(r => ({ ...r, details: JSON.stringify(r.details) }));
    if (format === 'csv')  return toCSV(res, 'audit-trail.csv', flat);
    if (format === 'xlsx') return toXLSX(res, 'audit-trail.xlsx', [{ name: 'Audit Trail', rows: flat }]);

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: parseInt(page), limit: parseInt(limit), rows });
  } catch (err) { next(err); }
}

// ─── Exception Report (legacy) ───────────────────────────────────────────────
async function exceptionReport(req, res, next) {
  try {
    const { rows: cfg } = await db.query("SELECT value FROM system_config WHERE key='overstay_threshold_hours'");
    const threshold = parseFloat(cfg[0]?.value || 3);
    const { format = 'json' } = req.query;

    const { rows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number, ct.agent_name, ct.agent_phone,
             ha.name AS area, b.bay_code, ct.time_in,
             ROUND(EXTRACT(EPOCH FROM (NOW()-COALESCE(ct.time_in,ct.arrival_time,ct.created_at)))/3600, 2) AS hours_in_holding,
             'OVERSTAYED' AS exception_type
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
      LEFT JOIN bays b ON b.id=ct.bay_id
      WHERE ct.status=ANY($1)
        AND EXTRACT(EPOCH FROM (NOW()-COALESCE(ct.time_in,ct.arrival_time,ct.created_at)))/3600 > $2
      ORDER BY ct.time_in ASC
    `, [ACTIVE_STATUSES, threshold]);

    if (format === 'csv')  return toCSV(res, 'exception-report.csv', rows);
    if (format === 'xlsx') return toXLSX(res, 'exception-report.xlsx', [{ name: 'Exceptions', rows }]);
    return res.json({ threshold_hours: threshold, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Email Config ─────────────────────────────────────────────────────────────
async function getEmailConfig(req, res, next) {
  try {
    const EMAIL_KEYS = ['alert_enabled', 'alert_recipients', 'daily_report_enabled', 'daily_report_time', 'daily_report_recipients'];
    const { rows } = await db.query(`SELECT key, value FROM system_config WHERE key = ANY($1)`, [EMAIL_KEYS]);
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const { isConfigured } = require('../services/emailService');
    return res.json({
      smtp_configured: isConfigured(),
      alert_enabled: cfg.alert_enabled === 'true',
      alert_recipients: (() => { try { return JSON.parse(cfg.alert_recipients || '[]'); } catch { return []; } })(),
      daily_report_enabled: cfg.daily_report_enabled === 'true',
      daily_report_time: cfg.daily_report_time || '17:00',
      daily_report_recipients: (() => { try { return JSON.parse(cfg.daily_report_recipients || '[]'); } catch { return []; } })(),
    });
  } catch (err) { next(err); }
}

async function updateEmailConfig(req, res, next) {
  try {
    const { alert_enabled, alert_recipients, daily_report_enabled, daily_report_time, daily_report_recipients } = req.body;
    const updates = [
      ['alert_enabled',            String(!!alert_enabled)],
      ['alert_recipients',         JSON.stringify(Array.isArray(alert_recipients) ? alert_recipients : [])],
      ['daily_report_enabled',     String(!!daily_report_enabled)],
      ['daily_report_time',        daily_report_time || '17:00'],
      ['daily_report_recipients',  JSON.stringify(Array.isArray(daily_report_recipients) ? daily_report_recipients : [])],
    ];
    for (const [key, value] of updates) {
      await db.query(
        `INSERT INTO system_config (key, value, updated_by, updated_at) VALUES ($1,$2,$3,NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=NOW()`,
        [key, value, req.user.id]
      );
    }
    return res.json({ message: 'Email config saved.' });
  } catch (err) { next(err); }
}

async function testEmail(req, res, next) {
  try {
    const { sendEmail, verifyConnection } = require('../services/emailService');
    const check = await verifyConnection();
    if (!check.ok) return res.status(400).json({ error: `SMTP connection failed: ${check.reason}` });
    const to = req.body.to || req.user.email;
    if (!to) return res.status(400).json({ error: 'No recipient — provide "to" or ensure your user has an email address.' });
    await sendEmail({
      to,
      subject: 'ScanPort ERP — Test Email',
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px">
        <h2 style="color:#1e40af">&#10003; SMTP is working</h2>
        <p>This test email confirms that ScanPort ERP can send emails from your configured SMTP server.</p>
        <p style="color:#6b7280;font-size:13px">SLA breach alerts and daily reports will be delivered to the recipient addresses you configure in the Email &amp; Alerts settings.</p>
      </div>`,
    });
    return res.json({ message: `Test email sent to ${to}.` });
  } catch (err) { next(err); }
}

// ─── System Config ────────────────────────────────────────────────────────────
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

module.exports = {
  dailyReport, dwellTimeReport, agentPerformanceReport, auditTrail,
  exceptionReport, getSystemConfig, updateSystemConfig,
  operationsDashboard, dwellAnalysis, areaPerformance, slaExceptions, exportReport,
  getEmailConfig, updateEmailConfig, testEmail,
};
