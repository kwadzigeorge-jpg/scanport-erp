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
      is_reefer = false,    // route to reefer bays when true
    } = req.body;

    // ── Validate required fields ──
    const reeferFlag = is_reefer === true || is_reefer === 'true';

    if (!agentName?.trim())     return res.status(400).json({ error: 'Agent name is required.' });
    if (!agentPhone?.trim() || !validatePhoneNumber(agentPhone))   return res.status(400).json({ error: 'Valid agent phone is required.' });
    if (!Array.isArray(containers) || containers.length === 0)     return res.status(400).json({ error: 'At least one container is required.' });

    const truckNumberVal = truckNumber?.trim()  || null;
    const driverNameVal  = driverName?.trim()   || null;
    const driverPhoneVal = driverPhone?.trim()  || null;

    // ── Validate container numbers + sizes ──
    const validatedContainers = [];
    for (const c of containers) {
      const v = validateContainerNumber(c.number);
      if (!v.valid) return res.status(400).json({ error: v.message });
      const size = c.size === '40ft' ? '40ft' : '20ft';
      validatedContainers.push({ number: v.value, size });
    }

    // ── Validate truck load rules (skip for reefer batches — multiple containers share one bay sequentially) ──
    if (!reeferFlag) {
      const loadErr = validateTruckLoad(validatedContainers);
      if (loadErr) return res.status(400).json({ error: loadErr });
    } else if (validatedContainers.length > 20) {
      return res.status(400).json({ error: 'A reefer batch cannot exceed 20 containers.' });
    }

    // ── Agent container limit (max 10 active for regular; reefer batch counts differently) ──
    const ACTIVE_STATUSES = [
      'ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED',
      'ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED',
    ];
    if (!reeferFlag) {
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

    // ── Auto-merge: if agent already has an active reefer bay, append to it ──
    if (reeferFlag) {
      const { rows: existingAllocs } = await client.query(
        `SELECT ta.*, b.bay_code, ha.name AS area_name, ha.code AS area_code
         FROM truck_allocations ta
         JOIN bays b ON b.id = ta.bay_id
         JOIN holding_areas ha ON ha.id = ta.holding_area_id
         WHERE ta.agent_phone = $1 AND ta.is_reefer = TRUE AND ta.status = 'IN_BAY'
         ORDER BY ta.time_in DESC LIMIT 1`,
        [agentPhone.trim()]
      );

      if (existingAllocs.length) {
        const existing = existingAllocs[0];

        // Check batch size limit
        const { rows: existingCts } = await client.query(
          `SELECT container_number FROM container_transactions WHERE truck_allocation_id = $1`,
          [existing.id]
        );
        if (existingCts.length + validatedContainers.length > 20) {
          return res.status(400).json({
            error: `Bay ${existing.bay_code} already has ${existingCts.length} container(s) — only ${20 - existingCts.length} more allowed (max 20 per batch).`,
          });
        }

        // Check duplicates within the existing allocation
        const existingNums = new Set(existingCts.map(r => r.container_number));
        for (const c of validatedContainers) {
          if (existingNums.has(c.number)) {
            return res.status(409).json({ error: `Container ${c.number} is already assigned to bay ${existing.bay_code}.` });
          }
        }

        // Insert new container transactions under the existing allocation
        const newTxns = [];
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
             RETURNING id, transaction_id, container_number, container_size, status, qr_code_token`,
            [txnId, c.number, c.size, existing.agent_name, existing.agent_phone,
             existing.truck_number, existing.driver_name, existing.driver_phone,
             existing.holding_area_id, existing.bay_id, existing.id,
             qrDataUrl, qrToken, req.user.id]
          );
          newTxns.push(txn);
        }

        await client.query('COMMIT');

        await logAudit(req, 'reefer:containers_auto_merged', 'truck_allocations', existing.id, {
          allocationRef: existing.allocation_ref,
          bayCode: existing.bay_code,
          added: validatedContainers.map(c => c.number),
        });

        const io = req.app.get('io');
        if (io) io.to('operations').emit('transaction:updated', { type: 'reefer_containers_added', allocationId: existing.id });

        return res.status(201).json({
          ...existing,
          containers:  newTxns,
          auto_merged: true,
        });
      }
    }

    // ── Resolve bay and holding area ──
    let resolvedBayId = bayId || null;
    let areaId = holdingAreaId || null;
    const occupiedStatuses = "('BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED','IN_HOLDING_AREA')";

    // Truck number is required for regular allocations; optional for reefer
    if (!reeferFlag && !truckNumber?.trim()) {
      return res.status(400).json({ error: 'Truck number is required.' });
    }

    if (resolvedBayId) {
      // Specific bay requested — verify it is free and matches reefer expectation
      const { rows: occ } = await client.query(
        `SELECT id FROM container_transactions WHERE bay_id=$1 AND status IN ${occupiedStatuses}`,
        [resolvedBayId]
      );
      if (occ.length) return res.status(409).json({ error: 'Selected bay is currently occupied. Choose another bay.' });
      // Verify reefer alignment
      const { rows: bi } = await client.query('SELECT holding_area_id, is_reefer FROM bays WHERE id=$1', [resolvedBayId]);
      if (!bi.length) return res.status(404).json({ error: 'Bay not found.' });
      if (bi[0].is_reefer !== reeferFlag) {
        return res.status(409).json({
          error: reeferFlag
            ? 'The selected bay is not a reefer bay. Choose a reefer-designated bay.'
            : 'The selected bay is a reefer bay and cannot be used for regular containers.',
        });
      }
      if (!areaId) areaId = bi[0].holding_area_id;
    } else if (areaId) {
      // Specific area requested — find first free bay matching reefer flag
      const { rows: freeBays } = await client.query(
        `SELECT b.id FROM bays b
         WHERE b.holding_area_id=$1 AND b.is_active=TRUE AND b.is_reefer=$2
           AND b.id NOT IN (
             SELECT bay_id FROM container_transactions
             WHERE status IN ${occupiedStatuses} AND bay_id IS NOT NULL
           )
         ORDER BY b.bay_code LIMIT 1`,
        [areaId, reeferFlag]
      );
      if (!freeBays.length) {
        return res.status(409).json({
          error: reeferFlag
            ? 'No reefer bays available in the selected area.'
            : 'Selected holding area is full.',
        });
      }
      resolvedBayId = freeBays[0].id;
    } else {
      // Auto-assign: search ALL active holding areas in order
      const { rows: freeBays } = await client.query(
        `SELECT b.id, b.holding_area_id FROM bays b
         JOIN holding_areas ha ON ha.id = b.holding_area_id
         WHERE ha.is_active = TRUE AND b.is_active = TRUE AND b.is_reefer = $1
           AND b.id NOT IN (
             SELECT bay_id FROM container_transactions
             WHERE status IN ${occupiedStatuses} AND bay_id IS NOT NULL
           )
         ORDER BY ha.id, b.bay_code LIMIT 1`,
        [reeferFlag]
      );
      if (!freeBays.length) {
        return res.status(409).json({
          error: reeferFlag
            ? 'All reefer bays are currently full. Please wait for a reefer bay to be released.'
            : 'All bays across all holding areas are currently full. Please wait for a truck to be released.',
        });
      }
      resolvedBayId = freeBays[0].id;
      areaId = freeBays[0].holding_area_id;
    }

    // ── Create truck allocation ──
    const allocationRef = await generateTruckRef(client);
    const { rows: [truck] } = await client.query(
      `INSERT INTO truck_allocations
         (allocation_ref, truck_number, driver_name, driver_phone,
          agent_name, agent_phone, holding_area_id, bay_id, status, is_reefer, time_in, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'IN_BAY',$9,NOW(),$10)
       RETURNING *`,
      [allocationRef, truckNumberVal, driverNameVal, driverPhoneVal,
       agentName.trim(), agentPhone.trim(), areaId, resolvedBayId, reeferFlag, req.user.id]
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
         RETURNING id, transaction_id, container_number, container_size, status, qr_code_token`,
        [txnId, c.number, c.size, agentName.trim(), agentPhone.trim(),
         truckNumberVal, driverNameVal, driverPhoneVal,
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
      allocationRef, truckNumber: truckNumberVal, containers: validatedContainers.map(c => c.number),
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
      `SELECT b.id, b.bay_code, b.holding_area_id, b.capacity, b.is_reefer,
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

    const regular = rows.filter(r => !r.is_reefer);
    const reefer  = rows.filter(r => r.is_reefer);

    return res.json({
      bays:          rows,
      total:         rows.length,
      free:          rows.filter(r => !r.is_occupied && !r.is_reefer).length,
      occupied:      rows.filter(r => r.is_occupied  && !r.is_reefer).length,
      reefer_total:  reefer.length,
      reefer_free:   reefer.filter(r => !r.is_occupied).length,
      reefer_occupied: reefer.filter(r => r.is_occupied).length,
      regular_total: regular.length,
      regular_free:  regular.filter(r => !r.is_occupied).length,
    });
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

// ─── Check In a Single Reefer Container ──────────────────────────────────────
// Marks one container in a reefer batch as arrived at the bay (physically present).
async function checkinReeferContainer(req, res, next) {
  try {
    const { id } = req.params; // container_transaction id

    const { rows } = await db.query(
      `SELECT ct.*, b.is_reefer FROM container_transactions ct
       JOIN bays b ON b.id = ct.bay_id
       WHERE ct.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Container transaction not found.' });
    const ct = rows[0];

    if (!ct.is_reefer) return res.status(409).json({ error: 'This container is not in a reefer bay.' });
    if (ct.status !== 'BAY_ASSIGNED') {
      return res.status(409).json({ error: `Container is already ${ct.status.replace(/_/g, ' ').toLowerCase()}.` });
    }

    await db.query(
      `UPDATE container_transactions
       SET status = 'ARRIVED_AT_BAY', bay_entry_time = NOW(), time_in = NOW()
       WHERE id = $1`,
      [id]
    );

    await logAudit(req, 'reefer:container_checkin', 'container_transactions', id, {
      containerNumber: ct.container_number, bayId: ct.bay_id,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { type: 'reefer_checkin', containerId: id });

    return res.json({ message: `Container ${ct.container_number} checked in to bay.`, status: 'ARRIVED_AT_BAY' });
  } catch (err) { next(err); }
}

// ─── Release a Single Reefer Container ───────────────────────────────────────
// Marks one container in a reefer batch as exited. Auto-closes the batch when
// all containers have exited.
async function releaseReeferContainer(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { id } = req.params; // container_transaction id

    const { rows } = await client.query(
      `SELECT ct.*, b.is_reefer FROM container_transactions ct
       JOIN bays b ON b.id = ct.bay_id
       WHERE ct.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Container transaction not found.' });
    const ct = rows[0];

    if (!ct.is_reefer) return res.status(409).json({ error: 'This container is not in a reefer bay.' });
    const releasable = ['ARRIVED_AT_BAY', 'UNDER_EXAMINATION', 'EXAMINATION_COMPLETED', 'BAY_ASSIGNED'];
    if (!releasable.includes(ct.status)) {
      return res.status(409).json({ error: `Container cannot be released from status ${ct.status}.` });
    }

    const timeOut = new Date();
    const dwellMins = ct.time_in
      ? Math.round((timeOut - new Date(ct.time_in)) / 60000)
      : null;

    await client.query(
      `UPDATE container_transactions
       SET status = 'EXITED', time_out = $1, dwell_minutes = $2, confirmed_exit_by = $3
       WHERE id = $4`,
      [timeOut, dwellMins, req.user.id, id]
    );

    // Auto-close the reefer batch (truck_allocation) if all containers are now done
    if (ct.truck_allocation_id) {
      const { rows: remaining } = await client.query(
        `SELECT id FROM container_transactions
         WHERE truck_allocation_id = $1
           AND status NOT IN ('EXITED', 'CANCELLED')
           AND id != $2`,
        [ct.truck_allocation_id, id]
      );
      if (!remaining.length) {
        await client.query(
          `UPDATE truck_allocations
           SET status = 'RELEASED', time_out = $1, released_by = $2
           WHERE id = $3`,
          [timeOut, req.user.id, ct.truck_allocation_id]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit(req, 'reefer:container_released', 'container_transactions', id, {
      containerNumber: ct.container_number, bayId: ct.bay_id, dwellMins,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { type: 'reefer_release', containerId: id });

    return res.json({ message: `Container ${ct.container_number} released. Bay slot freed.`, status: 'EXITED' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── Add Containers to Existing Reefer Allocation ─────────────────────────────
// Allows a booth officer to append more containers to an active reefer batch
// when the agent's remaining containers arrive after the initial allocation.
async function addContainersToAllocation(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { id } = req.params; // truck_allocation id
    const { containers } = req.body;

    if (!Array.isArray(containers) || containers.length === 0) {
      return res.status(400).json({ error: 'At least one container is required.' });
    }

    // Fetch and validate the allocation
    const { rows: allocRows } = await client.query(
      `SELECT * FROM truck_allocations WHERE id=$1`, [id]
    );
    if (!allocRows.length) return res.status(404).json({ error: 'Allocation not found.' });
    const alloc = allocRows[0];

    if (!alloc.is_reefer) return res.status(400).json({ error: 'Can only add containers to a reefer allocation.' });
    if (alloc.status !== 'IN_BAY') return res.status(400).json({ error: 'This allocation is no longer active.' });

    // Check total container count
    const { rows: existingCts } = await client.query(
      `SELECT container_number FROM container_transactions WHERE truck_allocation_id=$1`, [id]
    );
    if (existingCts.length + containers.length > 20) {
      return res.status(400).json({
        error: `Cannot exceed 20 containers per batch. This allocation already has ${existingCts.length} — only ${20 - existingCts.length} more allowed.`,
      });
    }

    // Validate container numbers and check for duplicates
    const existingNums = new Set(existingCts.map(r => r.container_number));
    const validatedContainers = [];
    for (const c of containers) {
      const v = validateContainerNumber(c.number);
      if (!v.valid) return res.status(400).json({ error: v.message });
      if (existingNums.has(v.value)) {
        return res.status(409).json({ error: `Container ${v.value} is already in this allocation.` });
      }
      // Check globally active
      const { rows: dup } = await client.query(
        `SELECT id FROM container_transactions
         WHERE container_number=$1 AND status IN ('PENDING','IN_HOLDING_AREA','ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED')`,
        [v.value]
      );
      if (dup.length) return res.status(409).json({ error: `Container ${v.value} already has an active allocation.` });
      existingNums.add(v.value); // prevent duplicates within this request
      validatedContainers.push({ number: v.value, size: c.size === '40ft' ? '40ft' : '20ft' });
    }

    // Insert new container transactions
    const newTxns = [];
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
        [txnId, c.number, c.size, alloc.agent_name, alloc.agent_phone,
         alloc.truck_number, alloc.driver_name, alloc.driver_phone,
         alloc.holding_area_id, alloc.bay_id, alloc.id,
         qrDataUrl, qrToken, req.user.id]
      );
      newTxns.push(txn);
    }

    await client.query('COMMIT');

    await logAudit(req, 'reefer:containers_added', 'truck_allocations', alloc.id, {
      allocationRef: alloc.allocation_ref,
      added: validatedContainers.map(c => c.number),
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { type: 'reefer_containers_added', allocationId: alloc.id });

    return res.status(201).json({
      message: `${validatedContainers.length} container${validatedContainers.length !== 1 ? 's' : ''} added to ${alloc.allocation_ref}.`,
      containers: newTxns,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  createTruckAllocation, releaseTruck, listTruckAllocations, getAvailableBays,
  checkinReeferContainer, releaseReeferContainer, addContainersToAllocation,
};
