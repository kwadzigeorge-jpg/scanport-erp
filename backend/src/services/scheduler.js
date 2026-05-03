const cron = require('node-cron');
const db = require('../config/database');
const { sendEmail, isConfigured } = require('./emailService');

const ACTIVE_STATUSES = [
  'ARRIVED_AT_BOOTH', 'PENDING_BAY_ASSIGNMENT', 'BAY_ASSIGNED',
  'ARRIVED_AT_BAY', 'UNDER_EXAMINATION', 'EXAMINATION_COMPLETED',
];

// ─── Table Setup ──────────────────────────────────────────────────────────────
async function ensureAlertsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sla_alerts (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER NOT NULL REFERENCES container_transactions(id) ON DELETE CASCADE,
      alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(transaction_id)
    )
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(m) {
  const min = Math.round(parseFloat(m) || 0);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

async function getCfg(keys) {
  const { rows } = await db.query(
    `SELECT key, value FROM system_config WHERE key = ANY($1)`,
    [keys]
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function parseList(json) {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

// ─── SLA Breach Alerts ────────────────────────────────────────────────────────
async function checkSlaBreaches() {
  const cfg = await getCfg(['alert_enabled', 'alert_recipients', 'overstay_threshold_hours']);
  if (cfg.alert_enabled !== 'true') return;

  const recipients = parseList(cfg.alert_recipients);
  if (!recipients.length || !isConfigured()) return;

  const thresholdMin = parseFloat(cfg.overstay_threshold_hours || 3) * 60;

  const { rows } = await db.query(`
    SELECT ct.id, ct.transaction_id, ct.container_number, ct.container_type,
           ha.name AS holding_area, b.bay_code, ct.status, ct.time_in,
           ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at))) / 60)::int AS dwell_minutes
    FROM container_transactions ct
    LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
    LEFT JOIN bays b ON b.id = ct.bay_id
    LEFT JOIN sla_alerts sa ON sa.transaction_id = ct.id
    WHERE ct.status = ANY($1)
      AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at))) / 60 > $2
      AND sa.id IS NULL
  `, [ACTIVE_STATUSES, thresholdMin]);

  for (const row of rows) {
    const over = row.dwell_minutes - thresholdMin;
    try {
      await sendEmail({
        to: recipients,
        subject: `SLA Breach — Container ${row.container_number}`,
        html: slaAlertHtml(row, thresholdMin, over),
      });
      await db.query(
        `INSERT INTO sla_alerts (transaction_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [row.id]
      );
      console.log(`[alerts] SLA breach alert sent: ${row.container_number}`);
    } catch (err) {
      console.error(`[alerts] Failed to send alert for ${row.container_number}:`, err.message);
    }
  }
}

function slaAlertHtml(c, thresholdMin, over) {
  const host = process.env.PUBLIC_HOST ? `http://${process.env.PUBLIC_HOST}:8080` : 'http://209.97.136.191:8080';
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:#dc2626;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:18px">&#9888;&#65039; SLA Breach Alert</h2>
    <p style="margin:4px 0 0;opacity:.85;font-size:13px">ScanPort Holding Area ERP</p>
  </div>
  <div style="padding:24px;background:#fff">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="background:#f9fafb"><td style="padding:10px;color:#6b7280;width:42%">Container</td><td style="padding:10px;font-weight:700">${c.container_number}</td></tr>
      <tr><td style="padding:10px;color:#6b7280">Type</td><td style="padding:10px">${c.container_type || '—'}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:10px;color:#6b7280">Area / Bay</td><td style="padding:10px">${c.holding_area || '—'} / ${c.bay_code || '—'}</td></tr>
      <tr><td style="padding:10px;color:#6b7280">Status</td><td style="padding:10px">${c.status}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:10px;color:#6b7280">Check-in Time</td><td style="padding:10px">${c.time_in ? new Date(c.time_in).toLocaleString('en-GB') : '—'}</td></tr>
      <tr><td style="padding:10px;color:#6b7280">Dwell Time</td><td style="padding:10px;color:#dc2626;font-weight:700">${fmt(c.dwell_minutes)}</td></tr>
      <tr style="background:#fef2f2"><td style="padding:10px;color:#6b7280">Over SLA by</td><td style="padding:10px;color:#dc2626;font-weight:700">${fmt(over)} &nbsp;<span style="color:#9ca3af;font-weight:400">(SLA: ${fmt(thresholdMin)})</span></td></tr>
    </table>
    <div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;font-size:13px;color:#991b1b">
      This container requires immediate attention.
    </div>
  </div>
  <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">
    Sent by ScanPort ERP &middot; <a href="${host}/reports" style="color:#1d4ed8;text-decoration:none">View SLA Exceptions</a>
  </div>
</div>`;
}

// ─── Daily Report ─────────────────────────────────────────────────────────────
async function buildDailyData() {
  const today = new Date().toISOString().slice(0, 10);
  const thresholdMin = await db.query("SELECT value::float * 60 AS t FROM system_config WHERE key='overstay_threshold_hours'")
    .then(r => r.rows[0]?.t || 180);

  const [kpi, areas, exceptions] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE DATE(created_at) = $1)::int AS total_in,
        COUNT(*) FILTER (WHERE status = 'EXITED' AND DATE(time_out) = $1)::int AS total_out,
        COUNT(*) FILTER (WHERE status = ANY($2))::int AS currently_active,
        ROUND(AVG(dwell_minutes) FILTER (WHERE status='EXITED' AND DATE(time_out)=$1))::int AS avg_dwell_released
      FROM container_transactions
    `, [today, ACTIVE_STATUSES]),

    db.query(`
      SELECT ha.name,
             COUNT(ct.id) FILTER (WHERE ct.status = ANY($1))::int AS active,
             COUNT(ct.id) FILTER (WHERE DATE(ct.created_at) = $2)::int AS processed_today,
             ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)
               FILTER (WHERE ct.status = ANY($1)))::int AS avg_active_dwell
      FROM holding_areas ha
      LEFT JOIN container_transactions ct ON ct.holding_area_id = ha.id
      WHERE ha.is_active = TRUE
      GROUP BY ha.id, ha.name
      ORDER BY active DESC
    `, [ACTIVE_STATUSES, today]),

    db.query(`
      SELECT ct.container_number, ha.name AS holding_area, b.bay_code, ct.status,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60)::int AS dwell_minutes,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 - $2)::int AS over_sla
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
      LEFT JOIN bays b ON b.id = ct.bay_id
      WHERE ct.status = ANY($1)
        AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.time_in, ct.arrival_time, ct.created_at)))/60 > $2
      ORDER BY dwell_minutes DESC
      LIMIT 15
    `, [ACTIVE_STATUSES, thresholdMin]),
  ]);

  return { today, kpi: kpi.rows[0], areas: areas.rows, exceptions: exceptions.rows, thresholdMin };
}

function dailyReportHtml({ today, kpi, areas, exceptions, thresholdMin }) {
  const host = process.env.PUBLIC_HOST ? `http://${process.env.PUBLIC_HOST}:8080` : 'http://209.97.136.191:8080';
  const dateLabel = new Date(today + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const areaRows = areas.map((a, i) => `
    <tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
      <td style="padding:9px 12px">${a.name}</td>
      <td style="padding:9px 12px;text-align:center">${a.active}</td>
      <td style="padding:9px 12px;text-align:center">${a.processed_today}</td>
      <td style="padding:9px 12px;text-align:center">${a.avg_active_dwell ? fmt(a.avg_active_dwell) : '—'}</td>
    </tr>`).join('');

  const exRows = exceptions.map((e, i) => `
    <tr style="background:${i % 2 ? '#fff5f5' : '#fff'}">
      <td style="padding:9px 12px;font-weight:600">${e.container_number}</td>
      <td style="padding:9px 12px">${e.holding_area || '—'} / ${e.bay_code || '—'}</td>
      <td style="padding:9px 12px;color:#dc2626;font-weight:600">${fmt(e.dwell_minutes)}</td>
      <td style="padding:9px 12px;color:#dc2626">+${fmt(e.over_sla)}</td>
    </tr>`).join('');

  return `
<div style="font-family:sans-serif;max-width:700px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:#1e40af;color:#fff;padding:24px">
    <h1 style="margin:0;font-size:20px">ScanPort Daily Operations Report</h1>
    <p style="margin:6px 0 0;opacity:.8;font-size:13px">${dateLabel}</p>
  </div>

  <div style="padding:24px;background:#fff;border-bottom:1px solid #e5e7eb">
    <h2 style="margin:0 0 16px;font-size:15px;color:#374151">Key Metrics</h2>
    <table style="width:100%;border-collapse:separate;border-spacing:8px">
      <tr>
        <td style="background:#eff6ff;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#1d4ed8">${kpi.total_in || 0}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px">Containers In</div>
        </td>
        <td style="background:#f0fdf4;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#16a34a">${kpi.total_out || 0}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px">Released</div>
        </td>
        <td style="background:#fefce8;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:#ca8a04">${kpi.currently_active || 0}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px">Active Now</div>
        </td>
        <td style="background:${exceptions.length ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:32px;font-weight:800;color:${exceptions.length ? '#dc2626' : '#16a34a'}">${exceptions.length}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px">SLA Breaches</div>
        </td>
      </tr>
    </table>
    ${kpi.avg_dwell_released ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280">Average dwell (released today): <strong style="color:#111">${fmt(kpi.avg_dwell_released)}</strong></p>` : ''}
  </div>

  <div style="padding:24px;background:#fff;border-bottom:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;font-size:15px;color:#374151">Area Performance</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600">Area</th>
          <th style="padding:9px 12px;text-align:center;color:#6b7280;font-weight:600">Active</th>
          <th style="padding:9px 12px;text-align:center;color:#6b7280;font-weight:600">Processed Today</th>
          <th style="padding:9px 12px;text-align:center;color:#6b7280;font-weight:600">Avg Active Dwell</th>
        </tr>
      </thead>
      <tbody>${areaRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af">No area data</td></tr>'}</tbody>
    </table>
  </div>

  ${exceptions.length ? `
  <div style="padding:24px;background:#fff;border-bottom:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;font-size:15px;color:#dc2626">&#9888;&#65039; SLA Exceptions (${exceptions.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600">Container</th>
          <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600">Area / Bay</th>
          <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600">Dwell</th>
          <th style="padding:9px 12px;text-align:left;color:#6b7280;font-weight:600">Over SLA</th>
        </tr>
      </thead>
      <tbody>${exRows}</tbody>
    </table>
  </div>` : `
  <div style="padding:16px 24px;background:#f0fdf4;border-bottom:1px solid #e5e7eb">
    <p style="margin:0;color:#16a34a;font-size:13px">&#10003; No SLA exceptions — all active containers are within the ${fmt(thresholdMin)} threshold.</p>
  </div>`}

  <div style="padding:14px 24px;background:#f9fafb;font-size:12px;color:#9ca3af">
    Generated by ScanPort ERP &middot;
    <a href="${host}" style="color:#1d4ed8;text-decoration:none">Open Dashboard</a> &middot;
    <a href="${host}/reports" style="color:#1d4ed8;text-decoration:none">View Reports</a>
  </div>
</div>`;
}

// ─── Send Daily Report ────────────────────────────────────────────────────────
let lastDailyDate = null;

async function sendDailyReport() {
  const cfg = await getCfg(['daily_report_enabled', 'daily_report_recipients']);
  if (cfg.daily_report_enabled !== 'true') return;

  const recipients = parseList(cfg.daily_report_recipients);
  if (!recipients.length || !isConfigured()) return;

  try {
    const data = await buildDailyData();
    await sendEmail({
      to: recipients,
      subject: `ScanPort Daily Report — ${data.today}`,
      html: dailyReportHtml(data),
    });
    console.log(`[scheduler] Daily report sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.error('[scheduler] Daily report failed:', err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
function startScheduler() {
  ensureAlertsTable().catch(err => console.error('[scheduler] Table setup error:', err.message));

  // SLA breach check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try { await checkSlaBreaches(); }
    catch (err) { console.error('[scheduler] SLA check error:', err.message); }
  });

  // Daily report — check every minute, send when time matches (UTC)
  cron.schedule('* * * * *', async () => {
    try {
      const cfg = await getCfg(['daily_report_time', 'daily_report_enabled']);
      if (cfg.daily_report_enabled !== 'true') return;

      const [hh, mm] = (cfg.daily_report_time || '17:00').split(':').map(Number);
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      if (now.getUTCHours() === hh && now.getUTCMinutes() === mm && lastDailyDate !== today) {
        lastDailyDate = today;
        await sendDailyReport();
      }
    } catch (err) {
      console.error('[scheduler] Daily report check error:', err.message);
    }
  });

  console.log('[scheduler] Started — SLA checks every 5 min, daily report on schedule');
}

module.exports = { startScheduler, sendDailyReport, checkSlaBreaches };
