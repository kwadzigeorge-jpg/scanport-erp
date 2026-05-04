const db = require('../config/database');
const { logAudit } = require('../middleware/audit');
const { validateContainerNumber, validatePhoneNumber } = require('../utils/validators');
const { generateQRDataURL } = require('../services/qrService');

// Container size rules:
//   - A truck may carry: [20ft, 20ft] OR [20ft, 40ft] OR [40ft, 20ft] OR [20ft] OR [40ft]
//   - A 40ft + 40ft is NOT allowed
function validateTruckLoad(containers) {
  if (containers.length > 2) return 'A truck cannot carry more than 2 containers.';
  if (containers.length === 2) {
    const has40 = containers.some(c => c.size === '40ft');
    if (has40) return 'Two containers must both be 20ft. A 40ft container must be loaded alone.';
  }
  return null;
}

async function generateTruckRef(db) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM truck_allocations WHERE allocation_ref LIKE $1`,
    [`TRK-${dateStr}-%`]
  );
  const seq = (parseInt(rows[0].cnt) + 1).toString().padStart(4, '0');
  return `TRK-${dateStr}-${seq}`;
}

// ─── Create Truck Allocation (Bay Booth) ──────────────────────────────────────
async function createTruckAllocation(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const {
      truckNumber, driverName, driverPhone,
      agentName,  agentPhone,
      containers,           // array: [{ number, size }]
      holdingAreaId, bayId,
    } = req.body;

    // ── Validate required fields ──
    if (!truckNumber?.trim())   return res.status(400).json({ error: 'Truck number is required.' });
    if (!agentName?.trim())     return res.status(400).json({ error: 'Agent name is required.' });
    if (!agentPhone?.trim() || !validatePhoneNumber(agentPhone))   return res.status(400).json({ error: 'Valid agent phone is required.' });
    if (!Array.isArray(containers) || containers.length === 0)     return res.status(400).json({ error: 'At least one container is required.' });

    const driverNameVal  = driverName?.trim()  || null;
    const driverPhoneVal = driverPhone?.trim()  || null;

    // ── Validate container numbers + sizes ──
    const validatedContainers = [];
    for (const c of containers) {
      const v = validateContainerNumber(c.number);
      if (!v.valid) return res.status(400).json({ error: v.message });
      const size = c.size === '40ft' ? '40ft' : '20ft';
      validatedContainers.push({ number: v.value, size });
    }

    // ── Validate truck load rules ──
    const loadErr = validateTruckLoad(validatedContainers);
    if (loadErr) return res.status(400).json({ error: loadErr });

    // ── Agent container limit (max 10 active) ──
    const ACTIVE_STATUSES = [
      'ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED',
      'ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED',
    ];
    const { rows: agentCount } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM container_transactions
       WHERE agent_phone = $1 AND status = ANY($2)`,
      [agentPhone.trim(), ACTIVE_STATUSES]
    );
    const existing = agentCount[0].cnt;
    if (existing + validatedContainers.length > 10) {
      const remaining = 10 - existing;
      return res.status(409).json({
        error: remaining <= 0
          ? `Agent ${agentName.trim()} already has ${existing} active containers — the maximum is 10. They must release containers before new ones can be added.`
          : `Agent ${agentName.trim()} has ${existing} active containers. Adding ${validatedContainers.length} would exceed the limit of 10. Only ${remaining} more container${remaining === 1 ? '' : 's'} can be assigned to this agent.`,
      });
    }

    // ── Check for duplicate active containers ──
    for (const c of validatedContainers) {
      const { rows: dup } = await client.query(
        `SELECT id FROM container_transactions
         WHERE container_number=$1 AND status IN ('PENDING','IN_HOLDING_AREA','ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED')`,
        [c.number]
      );
      if (dup.length) return res.status(409).json({ error: `Container ${c.number} already has an active allocation.` });
    }

    // ── Resolve holding area ──
    let areaId = holdingAreaId;
    if (!areaId) {
      const { rows: areas } = await client.query('SELECT id FROM holding_areas WHERE is_active=TRUE LIMIT 1');
      if (!areas.length) return res.status(500).json({ error: 'No active holding areas.' });
      areaId = areas[0].id;
    }

    // ── Resolve bay (must be free — no active truck in new or old flow) ──
    let resolvedBayId = bayId || null;
    const occupiedStatuses = "('BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED','IN_HOLDING_AREA')";

    if (resolvedBayId) {
      const { rows: occ } = await client.query(
        `SELECT id FROM container_transactions WHERE bay_id=$1 AND status IN ${occupiedStatuses}`,
        [resolvedBayId]
      );
      if (occ.length) return res.status(409).json({ error: 'Selected bay is currently occupied. Choose another bay.' });
    } else {
      const { rows: freeBays } = await client.query(
        `SELECT b.id FROM bays b
         WHERE b.holding_area_id=$1 AND b.is_active=TRUE
           AND b.id NOT IN (
             SELECT bay_id FROM container_transactions
             WHERE status IN ${occupiedStatuses} AND bay_id IS NOT NULL
           )
         ORDER BY b.bay_code LIMIT 1`,
        [areaId]
      );
      if (!freeBays.length) {
        return res.status(409).json({
          error: 'All bays are currently full. Please wait for a truck to be released before making a new allocation.',
        });
      }
      resolvedBayId = freeBays[0].id;
    }

    // ── Create truck allocation ──
    const allocationRef = await generateTruckRef(client);
    const { rows: [truck] } = await client.query(
      `INSERT INTO truck_allocations
         (allocation_ref, truck_number, driver_name, driver_phone,
          agent_name, agent_phone, holding_area_id, bay_id, status, time_in, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'IN_BAY',NOW(),$9)
       RETURNING *`,
      [allocationRef, truckNumber.trim(), driverNameVal, driverPhoneVal,
       agentName.trim(), agentPhone.trim(), areaId, resolvedBayId, req.user.id]
    );

    // ── Create container transactions ──
    const txns = [];
    for (const c of validatedContainers) {
      const txnId = await generateTxnId(client);
      const { dataUrl: qrDataUrl, token: qrToken } = await generateQRDataURL(txnId, c.number);

      const { rows: [txn] } = await client.query(
        `INSERT INTO container_transactions
           (transaction_id, container_number, container_size, agent_name, agent_phone,
            truck_number, driver_name, driver_phone,
            holding_area_id, bay_id, truck_allocation_id,
            status, bay_assigned_time, qr_code_data, qr_code_token, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'BAY_ASSIGNED',NOW(),$12,$13,$14)
         RETURNING id, transaction_id, container_number, container_size, status`,
        [txnId, c.number, c.size, agentName.trim(), agentPhone.trim(),
         truckNumber.trim(), driverNameVal, driverPhoneVal,
         areaId, resolvedBayId, truck.id,
         qrDataUrl, qrToken, req.user.id]
      );
      txns.push(txn);
    }

    await client.query('COMMIT');

    // ── Get bay + area names ──
    const { rows: [meta] } = await db.query(
      `SELECT ha.name AS area_name, ha.code AS area_code, b.bay_code
       FROM holding_areas ha JOIN bays b ON b.id=$1 WHERE ha.id=$2`,
      [resolvedBayId, areaId]
    );

    await logAudit(req, 'truck:allocated', 'truck_allocations', truck.id, {
      allocationRef, truckNumber, containers: validatedContainers.map(c => c.number),
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:new', { type: 'truck', allocationRef });

    return res.status(201).json({
      ...truck,
      area_name: meta?.area_name,
      area_code: meta?.area_code,
      bay_code:  meta?.bay_code,
      containers: txns,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── Release Truck (from Bays View) ─────────────────────────────────────────
async function releaseTruck(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { id } = req.params;   // truck_allocation id or allocation_ref
    const { notes } = req.body || {};

    const { rows } = await client.query(
      `SELECT * FROM truck_allocations WHERE (id=$1 OR allocation_ref=$1) AND status='IN_BAY'`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Active truck allocation not found.' });
    const truck = rows[0];

    const timeOut = new Date();
    const dwellMins = Math.round((timeOut - new Date(truck.time_in)) / 60000);

    // Release the truck
    await client.query(
      `UPDATE truck_allocations
       SET status='RELEASED', time_out=$1, dwell_minutes=$2, released_by=$3, notes=$4
       WHERE id=$5`,
      [timeOut, dwellMins, req.user.id, notes || null, truck.id]
    );

    // Exit all containers under this truck
    await client.query(
      `UPDATE container_transactions
       SET status='EXITED', time_out=$1,
           dwell_minutes=ROUND(EXTRACT(EPOCH FROM ($1 - COALESCE(time_in, created_at)))/60),
           confirmed_exit_by=$2
       WHERE truck_allocation_id=$3 AND status IN ('PENDING','IN_HOLDING_AREA')`,
      [timeOut, req.user.id, truck.id]
    );

    await client.query('COMMIT');

    await logAudit(req, 'truck:released', 'truck_allocations', truck.id, {
      allocationRef: truck.allocation_ref, truckNumber: truck.truck_number, dwellMins,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { type: 'truck_released', truckId: truck.id });

    return res.json({
      message: 'Truck released successfully. Bay is now free.',
      allocationRef: truck.allocation_ref,
      truckNumber: truck.truck_number,
      dwellMinutes: dwellMins,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── List Truck Allocations ───────────────────────────────────────────────────
async function listTruckAllocations(req, res, next) {
  try {
    const { status = 'IN_BAY', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT ta.*, ha.name AS area_name, b.bay_code,
              json_agg(json_build_object(
                'id', ct.id, 'transaction_id', ct.transaction_id,
                'container_number', ct.container_number,
                'container_size', ct.container_size,
                'status', ct.status, 'dwell_minutes',
                CASE WHEN ct.time_in IS NOT NULL
                  THEN ROUND(EXTRACT(EPOCH FROM (NOW()-ct.time_in))/60)
                  ELSE ROUND(EXTRACT(EPOCH FROM (NOW()-ct.created_at))/60)
                END
              ) ORDER BY ct.created_at) AS containers
       FROM truck_allocations ta
       LEFT JOIN holding_areas ha ON ha.id=ta.holding_area_id
       LEFT JOIN bays b ON b.id=ta.bay_id
       LEFT JOIN container_transactions ct ON ct.truck_allocation_id=ta.id
       WHERE ta.status=$1
       GROUP BY ta.id, ha.name, b.bay_code
       ORDER BY ta.time_in DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), offset]
    );

    const { rows: cnt } = await db.query(
      'SELECT COUNT(*) FROM truck_allocations WHERE status=$1', [status]
    );

    return res.json({ trucks: rows, total: parseInt(cnt[0].count) });
  } catch (err) { next(err); }
}

// ─── Get available bays ───────────────────────────────────────────────────────
async function getAvailableBays(req, res, next) {
  try {
    const { holdingAreaId } = req.query;
    const conditions = ['b.is_active=TRUE'];
    const params = [];

    if (holdingAreaId) { params.push(holdingAreaId); conditions.push(`b.holding_area_id=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT b.id, b.bay_code, b.holding_area_id, b.capacity,
              ha.name AS area_name, ha.code AS area_code,
              CASE WHEN ct.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_occupied,
              ct.transaction_id AS allocation_ref, ct.truck_number
       FROM bays b
       JOIN holding_areas ha ON ha.id=b.holding_area_id
       LEFT JOIN container_transactions ct ON ct.bay_id=b.id
         AND ct.status IN ('BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED')
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.holding_area_id, b.bay_code`,
      params
    );

    const total    = rows.length;
    const free     = rows.filter(r => !r.is_occupied).length;
    const occupied = rows.filter(r => r.is_occupied).length;

    return res.json({ bays: rows, total, free, occupied });
  } catch (err) { next(err); }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function generateTxnId(client) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await client.query(
    `SELECT COUNT(*) AS cnt FROM container_transactions WHERE transaction_id LIKE $1`,
    [`TXN-${dateStr}-%`]
  );
  const seq = (parseInt(rows[0].cnt) + 1).toString().padStart(4, '0');
  return `TXN-${dateStr}-${seq}`;
}

module.exports = { createTruckAllocation, releaseTruck, listTruckAllocations, getAvailableBays };
