const db = require('../config/database');
const XLSX = require('xlsx');
const { format: csvFormat } = require('@fast-csv/format');

const ACTIVE_STATUSES = [
  'ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED',
  'ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED',
];

// ─── Excel / CSV helpers ─────────────────────────────────────────────────────

const HEADER_MAP = {
  transaction_id:       'Transaction ID',
  container_number:     'Container No.',
  container_size:       'Size',
  waybill_number:       'Waybill No.',
  agent_name:           'Agent Name',
  agent_phone:          'Agent Phone',
  truck_number:         'Truck No.',
  driver_name:          'Driver',
  driver_phone:         'Driver Phone',
  status:               'Status',
  bay_code:             'Bay',
  area:                 'Holding Area',
  holding_area:         'Holding Area',
  area_name:            'Holding Area',
  area_code:            'Area Code',
  time_in:              'Check-In Time',
  time_out:             'Released At',
  created_at:           'Created At',
  bay_assigned_time:    'Bay Assigned At',
  bay_entry_time:       'Check-In At',
  dwell_minutes:        'Dwell (min)',
  dwell_category:       'Dwell Category',
  dwell_status:         'Dwell Status',
  sla_result:           'SLA Result',
  minutes_over_sla:     'Over SLA (min)',
  check_in:             'Check-In Time',
  released_at:          'Released At',
  booth_officer:        'Booth Officer',
  entry_marshal:        'Entry Marshal',
  exit_marshal:         'Exit Marshal',
  username:             'User',
  role:                 'Role',
  action:               'Action',
  entity:               'Entity',
  entity_id:            'Entity ID',
  details:              'Details',
  ip_address:           'IP Address',
  exception_type:       'Exception Type',
  hours_in_holding:     'Hours in Holding',
  total_containers:     'Total Containers',
  total_trucks:         'Total Trucks',
  breach_count:         'SLA Breaches',
  on_time_count:        'On Time',
  date:                 'Date',
  id:                   'ID',
  // Fleet / mileage
  trip_date:            'Trip Date',
  trip_start_time:      'Start Time',
  trip_end_time:        'End Time',
  odometer_start:       'Odo Start (km)',
  odometer_end:         'Odo End (km)',
  distance_km:          'Distance (km)',
  trip_purpose:         'Purpose',
  origin:               'Origin',
  destination:          'Destination',
  fuel_added_litres:    'Fuel Added (L)',
  fuel_cost:            'Fuel Cost (GHS)',
  is_flagged:           'Flagged',
  flag_reason:          'Flag Reason',
  trip_status:          'Trip Status',
  registration_number:  'Vehicle Reg.',
  vehicle:              'Vehicle',
  total_km:             'Total KM',
  trips:                'Trips',
  flagged_count:        'Flagged Trips',
  avg_km:               'Avg KM / Trip',
  total_fuel_litres:    'Total Fuel (L)',
  total_fuel_cost:      'Total Fuel Cost (GHS)',
  month:                'Month',
  completed_trips:      'Completed Trips',
};

const STATUS_LABELS = {
  ARRIVED_AT_BOOTH:       'Arrived at Booth',
  PENDING_BAY_ASSIGNMENT: 'Pending Bay Assignment',
  BAY_ASSIGNED:           'Bay Assigned',
  ARRIVED_AT_BAY:         'Arrived at Bay',
  UNDER_EXAMINATION:      'Under Examination',
  EXAMINATION_COMPLETED:  'Examination Completed',
  IN_HOLDING_AREA:        'In Holding Area',
  EXITED:                 'Released',
  CANCELLED:              'Cancelled',
  IN_BAY:                 'In Bay',
  RELEASED:               'Released',
};

function fmtDateTime(d) {
  if (!d || isNaN(new Date(d))) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '');
}

function fmtDate(d) {
  if (!d || isNaN(new Date(d))) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatValue(key, val) {
  if (val === null || val === undefined) return '';
  // Status enum → human label
  if (key === 'status' && STATUS_LABELS[val]) return STATUS_LABELS[val];
  // JS Date objects (pg returns timestamps as Date)
  if (val instanceof Date) return fmtDateTime(val);
  // ISO timestamp strings
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return fmtDateTime(val);
  // Date-only strings
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return fmtDate(val);
  return val;
}

function sanitizeRows(rows) {
  if (!rows.length) return rows;
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      // Skip internal IDs that start with underscore or are raw db ids not useful to the reader
      if (k === 'id' && !HEADER_MAP[k]) continue;
      const header = HEADER_MAP[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      out[header] = formatValue(k, v);
    }
    return out;
  });
}

function toCSV(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = csvFormat({ headers: true });
  stream.pipe(res);
  sanitizeRows(rows).forEach(r => stream.write(r));
  stream.end();
}

function toXLSX(res, filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const clean = sanitizeRows(rows);
    const ws = XLSX.utils.json_to_sheet(clean);

    // Auto column widths capped at 50
    if (clean.length > 0) {
      const headers = Object.keys(clean[0]);
      ws['!cols'] = headers.map(h => ({
        wch: Math.min(
          Math.max(h.length, ...clean.map(r => String(r[h] ?? '').length)) + 2,
          50
        ),
      }));
    }

    XLSX.utils.book_append_sheet(wb, ws, name);
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
      WHERE ct.created_at >= $1::date AND ct.created_at < ($2::date + INTERVAL '1 day')
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
               AND ct.time_out >= $1::date AND ct.time_out < ($2::date + INTERVAL '1 day')
             )::int AS historical_breaches,
             COUNT(ct.id) FILTER (WHERE ct.created_at >= $1::date AND ct.created_at < ($2::date + INTERVAL '1 day'))::int AS total_period
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
      WHERE ct.created_at >= $1::date AND ct.created_at < ($2::date + INTERVAL '1 day')
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
        AND ct.time_out >= $1::date AND ct.time_out < ($2::date + INTERVAL '1 day')
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
        COUNT(*) FILTER (WHERE status='EXITED' AND time_out >= $2::date AND time_out < ($2::date + INTERVAL '1 day'))::int AS throughput_today,
        ROUND(AVG(dwell_minutes) FILTER (WHERE status='EXITED' AND time_out >= $2::date AND time_out < ($2::date + INTERVAL '1 day')))::int AS avg_dwell_today,
        COUNT(*) FILTER (WHERE status='EXITED' AND dwell_minutes > $3 AND time_out >= $2::date AND time_out < ($2::date + INTERVAL '1 day'))::int AS breaches_today,
        COUNT(*)::int AS total_period
      FROM container_transactions
      WHERE created_at >= $4::date AND created_at < ($5::date + INTERVAL '1 day')
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
      SELECT ct.transaction_id, ct.container_number,
             COALESCE(ct.container_size, '20ft') AS container_size,
             ct.waybill_number,
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
      SELECT ct.transaction_id, ct.container_number,
             COALESCE(ct.container_size, '20ft') AS container_size,
             ct.waybill_number,
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
        AND ct.time_out >= $1::date AND ct.time_out < ($2::date + INTERVAL '1 day')
      ORDER BY ct.time_out DESC
    `, [fromDate, toDate, slaMinutes]);

    // Sheet 4 — Timestamps
    const { rows: tsRows } = await db.query(`
      SELECT
        ct.transaction_id                                           AS "Transaction ID",
        ct.container_number                                         AS "Container No.",
        COALESCE(ct.container_size, '20ft')                         AS "Size",
        ct.truck_number                                             AS "Truck No.",
        ct.agent_name                                               AS "Agent",
        ha.name                                                     AS "Holding Area",
        b.bay_code                                                  AS "Bay",
        ct.status                                                   AS "Status",
        ct.bay_assigned_time                                        AS "Bay Assigned At",
        ct.bay_entry_time                                           AS "Check-In At",
        ct.time_out                                                 AS "Released At",
        CASE WHEN ct.bay_entry_time IS NOT NULL AND ct.bay_assigned_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.bay_entry_time - ct.bay_assigned_time))/60)::int
        END                                                         AS "Assign→Check-In (min)",
        CASE WHEN ct.time_out IS NOT NULL AND ct.bay_entry_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.time_out - ct.bay_entry_time))/60)::int
        END                                                         AS "Check-In→Release (min)",
        CASE WHEN ct.time_out IS NOT NULL AND ct.bay_assigned_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.time_out - ct.bay_assigned_time))/60)::int
        END                                                         AS "Assign→Release (min)"
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
      LEFT JOIN bays b ON b.id = ct.bay_id
      WHERE COALESCE(ct.bay_assigned_time, ct.created_at) >= $1::date
        AND COALESCE(ct.bay_assigned_time, ct.created_at) < ($2::date + INTERVAL '1 day')
      ORDER BY COALESCE(ct.bay_assigned_time, ct.created_at) DESC
    `, [fromDate, toDate]);

    return toXLSX(res, `scanport-report-${fromDate}-${toDate}.xlsx`, [
      { name: 'Executive Summary', rows: summary },
      { name: 'Active Containers', rows: activeRows },
      { name: 'Released History',  rows: releasedRows },
      { name: 'Timestamps',        rows: tsRows },
    ]);
  } catch (err) { next(err); }
}

// ─── Daily Operations Report (legacy) ────────────────────────────────────────
async function dailyReport(req, res, next) {
  try {
    const { date = new Date().toISOString().slice(0, 10), format = 'json' } = req.query;
    const { rows } = await db.query(`
      SELECT ct.transaction_id, ct.container_number,
             COALESCE(ct.container_size, '20ft') AS container_size,
             ct.agent_name, ct.agent_phone,
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
      WHERE ct.created_at >= $1::date AND ct.created_at < ($1::date + INTERVAL '1 day')
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
      SELECT ct.transaction_id, ct.container_number,
             COALESCE(ct.container_size, '20ft') AS container_size,
             ct.agent_name,
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
        AND ct.time_in >= $1::date AND ct.time_in < ($2::date + INTERVAL '1 day')
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
    if (from)   { params.push(from); conditions.push(`al.created_at >= $${params.length}::date`); }
    if (to)     { params.push(to);   conditions.push(`al.created_at < ($${params.length}::date + INTERVAL '1 day')`); }

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
      SELECT ct.transaction_id, ct.container_number,
             COALESCE(ct.container_size, '20ft') AS container_size,
             ct.agent_name, ct.agent_phone,
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

// ─── Dwell Trend ─────────────────────────────────────────────────────────────
async function dwellTrend(req, res, next) {
  try {
    const { period = 'daily' } = req.query;
    const slaMin = await getSlaMinutes();

    let sql;
    if (period === 'weekly') {
      sql = `
        SELECT
          TO_CHAR(DATE_TRUNC('week', time_out), 'DD Mon') AS label,
          DATE_TRUNC('week', time_out)::date              AS period_start,
          ROUND(AVG(dwell_minutes))::int                  AS avg_dwell,
          COUNT(*)::int                                   AS count
        FROM container_transactions
        WHERE status = 'EXITED'
          AND time_out >= CURRENT_DATE - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', time_out)
        ORDER BY DATE_TRUNC('week', time_out)`;
    } else if (period === 'monthly') {
      sql = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', time_out), 'Mon YYYY') AS label,
          DATE_TRUNC('month', time_out)::date                AS period_start,
          ROUND(AVG(dwell_minutes))::int                     AS avg_dwell,
          COUNT(*)::int                                      AS count
        FROM container_transactions
        WHERE status = 'EXITED'
          AND time_out >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', time_out)
        ORDER BY DATE_TRUNC('month', time_out)`;
    } else {
      sql = `
        SELECT
          TO_CHAR(DATE(time_out), 'DD Mon')  AS label,
          DATE(time_out)                     AS period_start,
          ROUND(AVG(dwell_minutes))::int     AS avg_dwell,
          COUNT(*)::int                      AS count
        FROM container_transactions
        WHERE status = 'EXITED'
          AND time_out >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(time_out)
        ORDER BY DATE(time_out)`;
    }

    const { rows } = await db.query(sql);
    return res.json({ period, sla_minutes: slaMin, rows });
  } catch (err) { next(err); }
}

// ─── Timestamp Report ─────────────────────────────────────────────────────────
async function timestampReport(req, res, next) {
  try {
    const { from, to, format = 'json' } = req.query;
    const fromDate = from || new Date().toISOString().slice(0, 10);
    const toDate   = to   || new Date().toISOString().slice(0, 10);

    const { rows } = await db.query(`
      SELECT
        ct.transaction_id,
        ct.container_number,
        ct.truck_number,
        ct.agent_name,
        ct.driver_name,
        ha.name AS holding_area,
        b.bay_code,
        ct.status,
        ct.bay_assigned_time,
        ct.bay_entry_time                                                    AS check_in_time,
        ct.time_out                                                          AS release_time,
        CASE WHEN ct.bay_entry_time IS NOT NULL AND ct.bay_assigned_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.bay_entry_time - ct.bay_assigned_time))/60)::int
        END                                                                  AS assign_to_checkin_mins,
        CASE WHEN ct.time_out IS NOT NULL AND ct.bay_entry_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.time_out - ct.bay_entry_time))/60)::int
        END                                                                  AS checkin_to_release_mins,
        CASE WHEN ct.time_out IS NOT NULL AND ct.bay_assigned_time IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (ct.time_out - ct.bay_assigned_time))/60)::int
        END                                                                  AS assign_to_release_mins
      FROM container_transactions ct
      LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
      LEFT JOIN bays b ON b.id = ct.bay_id
      WHERE COALESCE(ct.bay_assigned_time, ct.created_at) >= $1::date
        AND COALESCE(ct.bay_assigned_time, ct.created_at) < ($2::date + INTERVAL '1 day')
      ORDER BY COALESCE(ct.bay_assigned_time, ct.created_at) DESC
    `, [fromDate, toDate]);

    if (format === 'csv')  return toCSV(res,  `timestamps-${fromDate}-${toDate}.csv`,  rows);
    if (format === 'xlsx') return toXLSX(res, `timestamps-${fromDate}-${toDate}.xlsx`, [{ name: 'Timestamps', rows }]);
    return res.json({ from: fromDate, to: toDate, total: rows.length, rows });
  } catch (err) { next(err); }
}

// ─── Mileage Report ──────────────────────────────────────────────────────────
async function mileageReport(req, res, next) {
  try {
    const { from, to, vehicle_id, driver_id, status, format = 'json' } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate   = to   || today;

    const cond = [
      'ml.trip_date >= $1::date',
      'ml.trip_date < ($2::date + INTERVAL \'1 day\')',
    ];
    const p = [fromDate, toDate];

    if (vehicle_id) { p.push(vehicle_id); cond.push(`ml.vehicle_id = $${p.length}`); }
    if (driver_id)  { p.push(driver_id);  cond.push(`ml.driver_id  = $${p.length}`); }
    if (status)     { p.push(status);     cond.push(`ml.status     = $${p.length}`); }

    const where = cond.join(' AND ');

    const [detailRes, summaryRes, byVehicleRes, byDriverRes, byMonthRes] = await Promise.all([
      db.query(`
        SELECT
          ml.trip_date,
          ml.trip_start_time,
          ml.trip_end_time,
          ml.trip_status,
          ml.status,
          v.registration_number,
          v.make || ' ' || v.model        AS vehicle,
          d.full_name                     AS driver_name,
          ml.trip_purpose,
          ml.origin,
          ml.destination,
          ml.odometer_start,
          ml.odometer_end,
          ml.distance_km,
          ml.fuel_added_litres,
          ml.fuel_cost,
          ml.is_flagged,
          ml.flag_reason,
          ml.remarks
        FROM fleet_mileage_logs ml
        JOIN fleet_vehicles v ON v.id = ml.vehicle_id
        JOIN fleet_drivers  d ON d.id = ml.driver_id
        WHERE ${where}
        ORDER BY ml.trip_date DESC, ml.created_at DESC
      `, p),

      db.query(`
        SELECT
          COUNT(*)::int                                                  AS total_trips,
          COUNT(*) FILTER (WHERE ml.trip_status = 'completed')::int     AS completed_trips,
          COUNT(*) FILTER (WHERE ml.trip_status = 'open')::int          AS open_trips,
          COALESCE(SUM(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float  AS total_km,
          COALESCE(AVG(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float  AS avg_km,
          COUNT(*) FILTER (WHERE ml.is_flagged = TRUE)::int             AS flagged_trips,
          COUNT(*) FILTER (WHERE ml.status = 'pending')::int            AS pending_approval,
          COALESCE(SUM(ml.fuel_added_litres), 0)::float                 AS total_fuel_litres,
          COALESCE(SUM(ml.fuel_cost), 0)::float                         AS total_fuel_cost
        FROM fleet_mileage_logs ml
        JOIN fleet_vehicles v ON v.id = ml.vehicle_id
        JOIN fleet_drivers  d ON d.id = ml.driver_id
        WHERE ${where}
      `, p),

      db.query(`
        SELECT
          v.registration_number,
          v.make || ' ' || v.model                                       AS vehicle,
          COUNT(*)::int                                                  AS trips,
          COALESCE(SUM(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS total_km,
          COALESCE(AVG(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS avg_km,
          COUNT(*) FILTER (WHERE ml.is_flagged = TRUE)::int             AS flagged_count,
          COALESCE(SUM(ml.fuel_added_litres), 0)::float                 AS total_fuel_litres
        FROM fleet_mileage_logs ml
        JOIN fleet_vehicles v ON v.id = ml.vehicle_id
        JOIN fleet_drivers  d ON d.id = ml.driver_id
        WHERE ${where}
        GROUP BY v.id, v.registration_number, v.make, v.model
        ORDER BY total_km DESC
      `, p),

      db.query(`
        SELECT
          d.full_name                                                    AS driver_name,
          COUNT(*)::int                                                  AS trips,
          COALESCE(SUM(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS total_km,
          COALESCE(AVG(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS avg_km,
          COUNT(*) FILTER (WHERE ml.is_flagged = TRUE)::int             AS flagged_count,
          COALESCE(SUM(ml.fuel_added_litres), 0)::float                 AS total_fuel_litres
        FROM fleet_mileage_logs ml
        JOIN fleet_vehicles v ON v.id = ml.vehicle_id
        JOIN fleet_drivers  d ON d.id = ml.driver_id
        WHERE ${where}
        GROUP BY d.id, d.full_name
        ORDER BY total_km DESC
      `, p),

      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', ml.trip_date), 'Mon YYYY')          AS month,
          DATE_TRUNC('month', ml.trip_date)                               AS month_start,
          COUNT(*)::int                                                    AS trips,
          COUNT(*) FILTER (WHERE ml.trip_status = 'completed')::int       AS completed_trips,
          COALESCE(SUM(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS total_km,
          COALESCE(AVG(ml.distance_km) FILTER (WHERE ml.trip_status = 'completed'), 0)::float AS avg_km,
          COUNT(*) FILTER (WHERE ml.is_flagged = TRUE)::int               AS flagged_count,
          COALESCE(SUM(ml.fuel_added_litres), 0)::float                   AS total_fuel_litres,
          COALESCE(SUM(ml.fuel_cost), 0)::float                           AS total_fuel_cost
        FROM fleet_mileage_logs ml
        JOIN fleet_vehicles v ON v.id = ml.vehicle_id
        JOIN fleet_drivers  d ON d.id = ml.driver_id
        WHERE ${where}
        GROUP BY DATE_TRUNC('month', ml.trip_date)
        ORDER BY DATE_TRUNC('month', ml.trip_date)
      `, p),
    ]);

    const summary   = summaryRes.rows[0];
    const detail    = detailRes.rows;
    const byVehicle = byVehicleRes.rows;
    const byDriver  = byDriverRes.rows;
    const byMonth   = byMonthRes.rows.map(r => ({ ...r, month_start: undefined })); // drop raw timestamp

    if (format === 'xlsx') {
      return toXLSX(res, `mileage-report-${fromDate}-${toDate}.xlsx`, [
        { name: 'Monthly Summary', rows: byMonth },
        { name: 'By Vehicle',      rows: byVehicle },
        { name: 'By Driver',       rows: byDriver },
        { name: 'Detail',          rows: detail },
      ]);
    }
    if (format === 'csv') {
      return toCSV(res, `mileage-report-${fromDate}-${toDate}.csv`, detail);
    }

    return res.json({ from: fromDate, to: toDate, summary, detail, by_vehicle: byVehicle, by_driver: byDriver, by_month: byMonth });
  } catch (err) { next(err); }
}

module.exports = {
  dailyReport, dwellTimeReport, agentPerformanceReport, auditTrail,
  exceptionReport, getSystemConfig, updateSystemConfig,
  operationsDashboard, dwellAnalysis, areaPerformance, slaExceptions, exportReport,
  getEmailConfig, updateEmailConfig, testEmail,
  dwellTrend, timestampReport, mileageReport,
};
