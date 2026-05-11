const db = require('../config/database');

const ACTIVE_STATUSES = ['ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED'];

async function getConfig(pool, key, defaultVal) {
  const { rows } = await pool.query('SELECT value FROM system_config WHERE key=$1', [key]);
  return rows[0] ? parseFloat(rows[0].value) : defaultVal;
}

// ─── Real-time Summary ────────────────────────────────────────────────────────
async function getSummary(req, res, next) {
  try {
    const overstayHours = await getConfig(db, 'overstay_threshold_hours', 3);
    const thresholdMins = overstayHours * 60;

    // Per-state counts
    const { rows: statusRows } = await db.query(
      `SELECT status, COUNT(*) AS count FROM container_transactions GROUP BY status`
    );
    const counts = {};
    statusRows.forEach(r => { counts[r.status] = parseInt(r.count); });

    const activeCount = ACTIVE_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);

    // Overstayed (in any active state longer than threshold)
    const { rows: overstayRows } = await db.query(
      `SELECT COUNT(*) AS count FROM container_transactions
       WHERE status=ANY($1)
         AND EXTRACT(EPOCH FROM (NOW() - COALESCE(bay_assigned_time, arrival_time, created_at)))/60 > $2`,
      [ACTIVE_STATUSES, thresholdMins]
    );

    // Today's throughput
    const { rows: todayRows } = await db.query(
      `SELECT
         COUNT(*) AS entered,
         COUNT(*) FILTER (WHERE status='EXITED') AS exited
       FROM container_transactions
       WHERE DATE(COALESCE(arrival_time, created_at)) = CURRENT_DATE`
    );

    // Avg dwell today
    const { rows: avgRows } = await db.query(
      `SELECT ROUND(AVG(dwell_minutes)) AS avg_dwell
       FROM container_transactions
       WHERE status='EXITED' AND DATE(time_out)=CURRENT_DATE AND dwell_minutes IS NOT NULL`
    );

    // Bay utilisation
    const { rows: bayStats } = await db.query(
      `SELECT
         COUNT(DISTINCT b.id) AS total_bays,
         COUNT(DISTINCT CASE WHEN ct.status=ANY($1) THEN ct.bay_id END) AS occupied_bays
       FROM bays b
       LEFT JOIN container_transactions ct ON ct.bay_id=b.id AND ct.status=ANY($1)
       WHERE b.is_active=TRUE`,
      [['BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED']]
    );

    // Per holding area stats
    const { rows: areaStats } = await db.query(
      `SELECT ha.name, ha.code,
              COUNT(DISTINCT b.id) AS total_bays,
              COUNT(DISTINCT CASE WHEN ct.status=ANY($1) THEN ct.bay_id END) AS occupied
       FROM holding_areas ha
       LEFT JOIN bays b ON b.holding_area_id=ha.id AND b.is_active=TRUE
       LEFT JOIN container_transactions ct ON ct.holding_area_id=ha.id AND ct.status=ANY($1)
       WHERE ha.is_active=TRUE
       GROUP BY ha.id ORDER BY ha.name`,
      [['BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED']]
    );

    // Truck counts
    const { rows: truckRows } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='IN_BAY')::int AS active,
         COUNT(*) FILTER (WHERE DATE(time_in)=CURRENT_DATE)::int AS arrived_today
       FROM truck_allocations
       WHERE status='IN_BAY' OR DATE(time_in)=CURRENT_DATE`
    );

    // Active user sessions
    const { rows: activeSessions } = await db.query(
      `SELECT u.id, u.username, u.full_name, r.name AS role, s.last_active, s.ip_address
       FROM user_sessions s
       JOIN users u ON u.id=s.user_id
       JOIN roles r ON r.id=u.role_id
       WHERE s.expires_at > NOW()
       ORDER BY s.last_active DESC`
    );

    // Recent transactions (last 10)
    const { rows: recentTxns } = await db.query(
      `SELECT ct.transaction_id, ct.waybill_number, ct.container_number,
              ct.agent_name, ct.status, ct.created_at, ct.arrival_time,
              ha.name AS area_name, b.bay_code
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
       LEFT JOIN bays b ON b.id=ct.bay_id
       ORDER BY ct.updated_at DESC LIMIT 10`
    );

    // 24-hour hourly trend
    const { rows: trend } = await db.query(
      `SELECT DATE_TRUNC('hour', COALESCE(arrival_time, created_at)) AS hour,
              COUNT(*) FILTER (WHERE status != 'CANCELLED') AS entries,
              COUNT(*) FILTER (WHERE status='EXITED') AS exits
       FROM container_transactions
       WHERE COALESCE(arrival_time, created_at) > NOW() - INTERVAL '24 hours'
       GROUP BY 1 ORDER BY 1`
    );

    const totalBays  = parseInt(bayStats[0].total_bays);
    const occupiedBays = parseInt(bayStats[0].occupied_bays);

    return res.json({
      summary: {
        arrived_at_booth:       counts['ARRIVED_AT_BOOTH']       || 0,
        pending_bay_assignment: counts['PENDING_BAY_ASSIGNMENT'] || 0,
        bay_assigned:           counts['BAY_ASSIGNED']           || 0,
        arrived_at_bay:         counts['ARRIVED_AT_BAY']         || 0,
        under_examination:      counts['UNDER_EXAMINATION']      || 0,
        examination_completed:  counts['EXAMINATION_COMPLETED']  || 0,
        exited:                 counts['EXITED']                 || 0,
        cancelled:              counts['CANCELLED']              || 0,
        total_active:           activeCount,
        overstayed:             parseInt(overstayRows[0].count),
        // legacy aliases
        pending:    counts['BAY_ASSIGNED'] || 0,
        in_holding: (counts['ARRIVED_AT_BAY'] || 0) + (counts['UNDER_EXAMINATION'] || 0) + (counts['EXAMINATION_COMPLETED'] || 0),
      },
      today: {
        entered:   parseInt(todayRows[0].entered),
        exited:    parseInt(todayRows[0].exited),
        avg_dwell: parseInt(avgRows[0].avg_dwell) || 0,
      },
      bays: {
        total: totalBays, occupied: occupiedBays, free: totalBays - occupiedBays,
        utilization_pct: totalBays > 0 ? Math.round((occupiedBays / totalBays) * 100) : 0,
      },
      trucks: {
        active: truckRows[0].active,
        arrived_today: truckRows[0].arrived_today,
      },
      areaStats,
      activeSessions,
      recentTransactions: recentTxns,
      trend,
      overstayThresholdHours: overstayHours,
    });
  } catch (err) { next(err); }
}

// ─── Overstayed Containers ────────────────────────────────────────────────────
async function getOverstayed(req, res, next) {
  try {
    const overstayHours = await getConfig(db, 'overstay_threshold_hours', 3);
    const thresholdMins = overstayHours * 60;

    const { rows } = await db.query(
      `SELECT ct.transaction_id, ct.waybill_number, ct.container_number,
              ct.agent_name, ct.agent_phone, ct.truck_number, ct.status,
              ct.arrival_time, ct.bay_assigned_time,
              ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.bay_assigned_time, ct.arrival_time, ct.created_at)))/60) AS minutes_active,
              ha.name AS area_name, b.bay_code
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id=ct.holding_area_id
       LEFT JOIN bays b ON b.id=ct.bay_id
       WHERE ct.status=ANY($1)
         AND EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.bay_assigned_time, ct.arrival_time, ct.created_at)))/60 > $2
       ORDER BY minutes_active DESC`,
      [ACTIVE_STATUSES, thresholdMins]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { getSummary, getOverstayed };
