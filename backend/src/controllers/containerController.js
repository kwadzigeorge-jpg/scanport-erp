const db = require('../config/database');
const { logAudit } = require('../middleware/audit');
const { validateContainerNumber, validatePhoneNumber } = require('../utils/validators');
const { generateTransactionId, calcDwellMinutes } = require('../utils/helpers');
const { generateQRDataURL, verifyQRToken } = require('../services/qrService');
const integrationService = require('../services/integrationService');

// ─── State Machine ────────────────────────────────────────────────────────────
const STATUSES = [
  'ARRIVED_AT_BOOTH',
  'PENDING_BAY_ASSIGNMENT',
  'BAY_ASSIGNED',
  'ARRIVED_AT_BAY',
  'UNDER_EXAMINATION',
  'EXAMINATION_COMPLETED',
  'EXITED',
  'CANCELLED',
];

const ACTIVE_STATUSES = ['ARRIVED_AT_BOOTH','PENDING_BAY_ASSIGNMENT','BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED'];

// Resolve full transaction by id, transaction_id, or waybill
async function resolveTxn(ref) {
  const { rows } = await db.query(
    `SELECT ct.*, ha.name AS area_name, ha.code AS area_code, b.bay_code
     FROM container_transactions ct
     LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
     LEFT JOIN bays b ON b.id = ct.bay_id
     WHERE ct.id::text=$1 OR ct.transaction_id=$1 OR ct.waybill_number=$1
     ORDER BY ct.created_at DESC LIMIT 1`,
    [ref]
  );
  return rows[0] || null;
}

// ─── 1. Check-In (Booth Officer) ──────────────────────────────────────────────
// Agent arrives at booth, officer registers waybill + container
async function checkIn(req, res, next) {
  try {
    const { waybillNumber, containerNumber, agentName, agentPhone, truckNumber, driverName, driverPhone } = req.body;

    if (!waybillNumber?.trim()) return res.status(400).json({ error: 'Waybill number is required.' });

    const cnValidation = validateContainerNumber(containerNumber);
    if (!cnValidation.valid) return res.status(400).json({ error: cnValidation.message });
    const cn = cnValidation.value;

    if (!agentName?.trim()) return res.status(400).json({ error: 'Agent name is required.' });
    if (!agentPhone?.trim() || !validatePhoneNumber(agentPhone)) {
      return res.status(400).json({ error: 'Valid agent phone number is required.' });
    }

    // Check duplicate active waybill
    const { rows: dupWB } = await db.query(
      `SELECT id FROM container_transactions WHERE waybill_number=$1 AND status=ANY($2)`,
      [waybillNumber.trim().toUpperCase(), ACTIVE_STATUSES]
    );
    if (dupWB.length) return res.status(409).json({ error: `Waybill ${waybillNumber} already has an active transaction.` });

    // Check duplicate active container
    const { rows: dupCN } = await db.query(
      `SELECT id FROM container_transactions WHERE container_number=$1 AND status=ANY($2)`,
      [cn, ACTIVE_STATUSES]
    );
    if (dupCN.length) return res.status(409).json({ error: `Container ${cn} already has an active transaction.` });

    const txnId = await generateTransactionId(db);

    const { rows } = await db.query(
      `INSERT INTO container_transactions
         (transaction_id, waybill_number, container_number, agent_name, agent_phone,
          truck_number, driver_name, driver_phone, status, arrival_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ARRIVED_AT_BOOTH',NOW(),$9)
       RETURNING *`,
      [txnId, waybillNumber.trim().toUpperCase(), cn,
       agentName.trim(), agentPhone.trim(), truckNumber?.trim() || null,
       driverName?.trim() || null, driverPhone?.trim() || null, req.user.id]
    );

    await logAudit(req, 'container:checked_in', 'container_transaction', rows[0].id, {
      transactionId: txnId, waybillNumber, containerNumber: cn, agentName,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:new', { id: rows[0].id, transactionId: txnId, containerNumber: cn, status: 'ARRIVED_AT_BOOTH' });

    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── 2. Assign Bay (Booth Officer) ────────────────────────────────────────────
// Officer assigns a bay and generates QR chit → BAY_ASSIGNED
async function assignBay(req, res, next) {
  try {
    const { holdingAreaId, bayId } = req.body;

    const txn = await resolveTxn(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });

    const allowed = ['ARRIVED_AT_BOOTH', 'PENDING_BAY_ASSIGNMENT'];
    if (!allowed.includes(txn.status)) {
      return res.status(409).json({ error: `Cannot assign bay: status is ${txn.status}. Expected ARRIVED_AT_BOOTH or PENDING_BAY_ASSIGNMENT.` });
    }

    let resolvedAreaId = holdingAreaId;
    let resolvedBayId = bayId || null;

    if (!resolvedAreaId) {
      const { rows: areas } = await db.query('SELECT id FROM holding_areas WHERE is_active=TRUE LIMIT 1');
      if (!areas.length) return res.status(500).json({ error: 'No active holding areas configured.' });
      resolvedAreaId = areas[0].id;
    }

    if (!resolvedBayId) {
      const { rows: bays } = await db.query(
        `SELECT b.id FROM bays b
         WHERE b.holding_area_id=$1 AND b.is_active=TRUE
           AND b.id NOT IN (
             SELECT bay_id FROM container_transactions
             WHERE bay_id IS NOT NULL AND status=ANY($2)
           )
         ORDER BY b.bay_code LIMIT 1`,
        [resolvedAreaId, ACTIVE_STATUSES]
      );
      if (!bays.length) return res.status(409).json({ error: 'No available bays in selected holding area. All bays occupied.' });
      resolvedBayId = bays[0].id;
    } else {
      // Verify bay is not already occupied
      const { rows: occupied } = await db.query(
        `SELECT id FROM container_transactions WHERE bay_id=$1 AND status=ANY($2)`,
        [resolvedBayId, ACTIVE_STATUSES]
      );
      if (occupied.length) return res.status(409).json({ error: 'Selected bay is already occupied.' });
    }

    const { dataUrl: qrDataUrl, token: qrToken } = await generateQRDataURL(txn.transaction_id, txn.container_number);

    await db.query(
      `UPDATE container_transactions
       SET status='BAY_ASSIGNED', holding_area_id=$1, bay_id=$2,
           qr_code_data=$3, qr_code_token=$4, bay_assigned_time=NOW()
       WHERE id=$5`,
      [resolvedAreaId, resolvedBayId, qrDataUrl, qrToken, txn.id]
    );

    const { rows: details } = await db.query(
      `SELECT ha.name AS area_name, ha.code AS area_code, b.bay_code
       FROM holding_areas ha
       LEFT JOIN bays b ON b.holding_area_id=ha.id AND b.id=$1
       WHERE ha.id=$2`,
      [resolvedBayId, resolvedAreaId]
    );

    await logAudit(req, 'container:bay_assigned', 'container_transaction', txn.id, {
      transactionId: txn.transaction_id, bayId: resolvedBayId, areaId: resolvedAreaId,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: 'BAY_ASSIGNED' });

    // Notify agent (fire-and-forget)
    integrationService.notifyBayAssigned({
      agentPhone: txn.agent_phone, agentName: txn.agent_name,
      containerNumber: txn.container_number, waybillNumber: txn.waybill_number,
      bayCode: details[0]?.bay_code, areaName: details[0]?.area_name,
    }).catch(() => {});

    return res.json({
      ...txn, status: 'BAY_ASSIGNED',
      holding_area_id: resolvedAreaId, bay_id: resolvedBayId,
      qr_code_token: qrToken, qr_code_data: qrDataUrl,
      area_name: details[0]?.area_name, area_code: details[0]?.area_code,
      bay_code: details[0]?.bay_code,
    });
  } catch (err) { next(err); }
}

// ─── 3. Allocate (legacy one-step: check-in + assign bay) ────────────────────
// Kept for backward compatibility with existing booth UI
async function allocate(req, res, next) {
  try {
    const { waybillNumber, containerNumber, agentName, agentPhone, truckNumber, driverName, driverPhone, holdingAreaId, bayId } = req.body;

    const cnValidation = validateContainerNumber(containerNumber);
    if (!cnValidation.valid) return res.status(400).json({ error: cnValidation.message });
    const cn = cnValidation.value;

    if (!agentName?.trim()) return res.status(400).json({ error: 'Agent name is required.' });
    if (!agentPhone?.trim() || !validatePhoneNumber(agentPhone)) {
      return res.status(400).json({ error: 'Valid agent phone number is required.' });
    }

    // Check duplicates
    const wb = waybillNumber?.trim().toUpperCase() || null;
    if (wb) {
      const { rows: dupWB } = await db.query(
        `SELECT id FROM container_transactions WHERE waybill_number=$1 AND status=ANY($2)`,
        [wb, ACTIVE_STATUSES]
      );
      if (dupWB.length) return res.status(409).json({ error: `Waybill ${wb} already has an active transaction.` });
    }
    const { rows: dupCN } = await db.query(
      `SELECT id FROM container_transactions WHERE container_number=$1 AND status=ANY($2)`,
      [cn, ACTIVE_STATUSES]
    );
    if (dupCN.length) return res.status(409).json({ error: `Container ${cn} already has an active allocation.` });

    // Resolve holding area + bay
    let resolvedAreaId = holdingAreaId;
    let resolvedBayId = bayId || null;

    if (!resolvedAreaId) {
      const { rows: areas } = await db.query('SELECT id FROM holding_areas WHERE is_active=TRUE LIMIT 1');
      if (!areas.length) return res.status(500).json({ error: 'No active holding areas configured.' });
      resolvedAreaId = areas[0].id;
    }

    if (!resolvedBayId) {
      const { rows: bays } = await db.query(
        `SELECT b.id FROM bays b
         WHERE b.holding_area_id=$1 AND b.is_active=TRUE
           AND b.id NOT IN (
             SELECT bay_id FROM container_transactions
             WHERE bay_id IS NOT NULL AND status=ANY($2)
           )
         ORDER BY b.bay_code LIMIT 1`,
        [resolvedAreaId, ACTIVE_STATUSES]
      );
      if (bays.length) resolvedBayId = bays[0].id;
    }

    const txnId = await generateTransactionId(db);
    const { dataUrl: qrDataUrl, token: qrToken } = await generateQRDataURL(txnId, cn);

    const { rows } = await db.query(
      `INSERT INTO container_transactions
         (transaction_id, waybill_number, container_number, agent_name, agent_phone,
          truck_number, driver_name, driver_phone, holding_area_id, bay_id, status,
          qr_code_data, qr_code_token, arrival_time, bay_assigned_time, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'BAY_ASSIGNED',$11,$12,NOW(),NOW(),$13)
       RETURNING *`,
      [txnId, wb, cn, agentName.trim(), agentPhone.trim(),
       truckNumber?.trim() || null, driverName?.trim() || null, driverPhone?.trim() || null,
       resolvedAreaId, resolvedBayId, qrDataUrl, qrToken, req.user.id]
    );

    const txn = rows[0];
    const { rows: details } = await db.query(
      `SELECT ha.name AS area_name, ha.code AS area_code, b.bay_code
       FROM holding_areas ha
       LEFT JOIN bays b ON b.holding_area_id=ha.id AND b.id=$1
       WHERE ha.id=$2`,
      [resolvedBayId, resolvedAreaId]
    );

    await logAudit(req, 'container:allocated', 'container_transaction', txn.id, {
      transactionId: txnId, waybillNumber: wb, containerNumber: cn, agentName,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:new', { id: txn.id, transactionId: txnId, containerNumber: cn, status: 'BAY_ASSIGNED' });

    return res.status(201).json({
      ...txn,
      area_name: details[0]?.area_name, area_code: details[0]?.area_code, bay_code: details[0]?.bay_code,
      // legacy field aliases
      areaName: details[0]?.area_name, areaCode: details[0]?.area_code, bayCode: details[0]?.bay_code,
    });
  } catch (err) { next(err); }
}

// ─── 4. Confirm Arrival at Bay (Marshal) ─────────────────────────────────────
// Marshal scans QR at bay entrance → ARRIVED_AT_BAY
async function confirmEntry(req, res, next) {
  try {
    const { qrToken, containerNumber, transactionId, waybillNumber, driverName, driverPhone } = req.body;

    let txn;

    if (qrToken) {
      const payload = verifyQRToken(qrToken);
      if (!payload) return res.status(400).json({ error: 'Invalid or expired QR code.' });
      const { rows } = await db.query(
        'SELECT * FROM container_transactions WHERE transaction_id=$1',
        [payload.txn]
      );
      txn = rows[0];
      if (txn && txn.container_number !== payload.ctr) {
        return res.status(400).json({ error: 'QR code mismatch.' });
      }
    } else {
      const ref = containerNumber
        ? validateContainerNumber(containerNumber)?.value
        : (transactionId || waybillNumber);

      const { rows } = await db.query(
        `SELECT * FROM container_transactions
         WHERE (container_number=$1 OR transaction_id=$1 OR waybill_number=$1)
           AND status='BAY_ASSIGNED'
         ORDER BY created_at DESC LIMIT 1`,
        [ref || null]
      );
      txn = rows[0];
    }

    if (!txn) return res.status(404).json({ error: 'No BAY_ASSIGNED transaction found for this container/waybill.' });
    if (txn.status !== 'BAY_ASSIGNED') {
      return res.status(409).json({ error: `Transaction is already in status: ${txn.status}` });
    }

    const updates = [`status='ARRIVED_AT_BAY'`, `bay_entry_time=NOW()`, `time_in=NOW()`, `confirmed_entry_by=$1`];
    const params = [req.user.id];

    if (driverName?.trim()) { params.push(driverName.trim()); updates.push(`driver_name=$${params.length}`); }
    if (driverPhone?.trim()) { params.push(driverPhone.trim()); updates.push(`driver_phone=$${params.length}`); }

    params.push(txn.id);
    await db.query(`UPDATE container_transactions SET ${updates.join(', ')} WHERE id=$${params.length}`, params);

    await logAudit(req, 'container:arrived_at_bay', 'container_transaction', txn.id, {
      containerNumber: txn.container_number, transactionId: txn.transaction_id, waybillNumber: txn.waybill_number,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: 'ARRIVED_AT_BAY' });

    return res.json({
      message: 'Container arrival at bay confirmed.',
      transactionId: txn.transaction_id, containerNumber: txn.container_number, waybillNumber: txn.waybill_number,
    });
  } catch (err) { next(err); }
}

// ─── 5. Start Examination (Marshal) ──────────────────────────────────────────
async function startExamination(req, res, next) {
  try {
    const { examiningOfficer } = req.body;
    const txn = await resolveTxn(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });
    if (txn.status !== 'ARRIVED_AT_BAY') {
      return res.status(409).json({ error: `Cannot start examination: status is ${txn.status}. Container must be ARRIVED_AT_BAY.` });
    }

    await db.query(
      `UPDATE container_transactions
       SET status='UNDER_EXAMINATION', examination_start_time=NOW(),
           examination_started_by=$1, examining_officer=$2
       WHERE id=$3`,
      [req.user.id, examiningOfficer?.trim() || null, txn.id]
    );

    await logAudit(req, 'container:examination_started', 'container_transaction', txn.id, {
      containerNumber: txn.container_number, waybillNumber: txn.waybill_number,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: 'UNDER_EXAMINATION' });

    return res.json({
      message: 'Examination started.',
      transactionId: txn.transaction_id, containerNumber: txn.container_number,
    });
  } catch (err) { next(err); }
}

// ─── 6. Complete Examination (Marshal) ───────────────────────────────────────
async function completeExamination(req, res, next) {
  try {
    const { findings } = req.body;
    const txn = await resolveTxn(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });
    if (txn.status !== 'UNDER_EXAMINATION') {
      return res.status(409).json({ error: `Cannot complete examination: status is ${txn.status}. Examination must be started first.` });
    }

    await db.query(
      `UPDATE container_transactions
       SET status='EXAMINATION_COMPLETED', examination_end_time=NOW(),
           examination_completed_by=$1, examination_findings=$2
       WHERE id=$3`,
      [req.user.id, findings?.trim() || null, txn.id]
    );

    await logAudit(req, 'container:examination_completed', 'container_transaction', txn.id, {
      containerNumber: txn.container_number, waybillNumber: txn.waybill_number, findings,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: 'EXAMINATION_COMPLETED' });

    // Notify agent that examination is done
    integrationService.notifyExaminationComplete({
      agentPhone: txn.agent_phone, agentName: txn.agent_name,
      containerNumber: txn.container_number, waybillNumber: txn.waybill_number,
    }).catch(() => {});

    return res.json({
      message: 'Examination completed.',
      transactionId: txn.transaction_id, containerNumber: txn.container_number,
    });
  } catch (err) { next(err); }
}

// ─── 7. Release Truck / Confirm Exit (Marshal) ───────────────────────────────
async function confirmExit(req, res, next) {
  try {
    const { qrToken, containerNumber, transactionId, waybillNumber } = req.body;

    let txn;

    if (qrToken) {
      const payload = verifyQRToken(qrToken);
      if (!payload) return res.status(400).json({ error: 'Invalid or expired QR code.' });
      const { rows } = await db.query(
        "SELECT * FROM container_transactions WHERE transaction_id=$1",
        [payload.txn]
      );
      txn = rows[0];
    } else {
      const ref = containerNumber
        ? validateContainerNumber(containerNumber)?.value
        : (transactionId || waybillNumber);

      const { rows } = await db.query(
        `SELECT * FROM container_transactions
         WHERE (container_number=$1 OR transaction_id=$1 OR waybill_number=$1)
           AND status IN ('ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED','IN_HOLDING_AREA')
         ORDER BY created_at DESC LIMIT 1`,
        [ref || null]
      );
      txn = rows[0];
    }

    const releasableStatuses = ['ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED','IN_HOLDING_AREA'];
    if (!txn) return res.status(404).json({ error: 'No releasable transaction found for this container.' });
    if (!releasableStatuses.includes(txn.status)) {
      return res.status(409).json({
        error: `Cannot release: truck must be in the holding area. Current status: ${txn.status}.`,
      });
    }

    const timeOut = new Date();
    const dwell = calcDwellMinutes(txn.time_in || txn.arrival_time, timeOut);

    await db.query(
      `UPDATE container_transactions
       SET status='EXITED', time_out=$1, dwell_minutes=$2,
           confirmed_exit_by=$3, released_by=$3
       WHERE id=$4`,
      [timeOut, dwell, req.user.id, txn.id]
    );

    await logAudit(req, 'container:released', 'container_transaction', txn.id, {
      containerNumber: txn.container_number, dwellMinutes: dwell, waybillNumber: txn.waybill_number,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: 'EXITED' });

    // Notify agent
    integrationService.notifyTruckReleased({
      agentPhone: txn.agent_phone, agentName: txn.agent_name,
      containerNumber: txn.container_number, waybillNumber: txn.waybill_number, dwellMinutes: dwell,
    }).catch(() => {});

    return res.json({
      message: 'Truck released. Container exited.',
      transactionId: txn.transaction_id, containerNumber: txn.container_number,
      waybillNumber: txn.waybill_number, dwellMinutes: dwell,
    });
  } catch (err) { next(err); }
}

// ─── List Transactions ────────────────────────────────────────────────────────
async function listTransactions(req, res, next) {
  try {
    const { status, containerNumber, agentName, waybillNumber, truckNumber, from, to, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      // Support comma-separated statuses
      const statusList = status.toUpperCase().split(',').filter(s => STATUSES.includes(s));
      if (statusList.length) { params.push(statusList); conditions.push(`ct.status=ANY($${params.length})`); }
    }
    if (containerNumber) {
      const v = validateContainerNumber(containerNumber);
      if (v.valid) { params.push(v.value); conditions.push(`ct.container_number=$${params.length}`); }
    }
    if (waybillNumber) { params.push(`%${waybillNumber}%`); conditions.push(`ct.waybill_number ILIKE $${params.length}`); }
    if (agentName)     { params.push(`%${agentName}%`);    conditions.push(`ct.agent_name ILIKE $${params.length}`); }
    if (truckNumber)   { params.push(`%${truckNumber}%`);  conditions.push(`ct.truck_number ILIKE $${params.length}`); }
    if (from)          { params.push(from);                 conditions.push(`ct.created_at >= $${params.length}`); }
    if (to)            { params.push(to);                   conditions.push(`ct.created_at <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT ct.id, ct.transaction_id, ct.waybill_number, ct.container_number,
              ct.agent_name, ct.agent_phone, ct.truck_number, ct.driver_name, ct.driver_phone,
              ct.status, ct.arrival_time, ct.bay_assigned_time, ct.bay_entry_time,
              ct.examination_start_time, ct.examination_end_time,
              ct.time_in, ct.time_out, ct.dwell_minutes,
              ct.examination_findings, ct.examining_officer, ct.notes,
              ct.created_at, ct.updated_at,
              ha.name AS area_name, ha.code AS area_code, b.bay_code,
              ub.username AS booth_officer, ub.full_name AS booth_officer_name,
              ue.username AS entry_marshal, ux.username AS exit_marshal
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
       LEFT JOIN bays b ON b.id = ct.bay_id
       LEFT JOIN users ub ON ub.id = ct.created_by
       LEFT JOIN users ue ON ue.id = ct.confirmed_entry_by
       LEFT JOIN users ux ON ux.id = ct.confirmed_exit_by
       ${where}
       ORDER BY ct.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) FROM container_transactions ct ${where}`, params
    );

    return res.json({ transactions: rows, total: parseInt(cnt[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

// ─── Get single transaction ───────────────────────────────────────────────────
async function getTransaction(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT ct.*,
              ha.name AS area_name, ha.code AS area_code, b.bay_code,
              ub.full_name AS booth_officer_name, ub.username AS booth_officer,
              ue.full_name AS entry_marshal_name,
              ux.full_name AS exit_marshal_name,
              es.full_name AS exam_started_by_name,
              ec.full_name AS exam_completed_by_name
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
       LEFT JOIN bays b ON b.id = ct.bay_id
       LEFT JOIN users ub ON ub.id = ct.created_by
       LEFT JOIN users ue ON ue.id = ct.confirmed_entry_by
       LEFT JOIN users ux ON ux.id = ct.confirmed_exit_by
       LEFT JOIN users es ON es.id = ct.examination_started_by
       LEFT JOIN users ec ON ec.id = ct.examination_completed_by
       WHERE ct.id::text=$1 OR ct.transaction_id=$1 OR ct.waybill_number=$1 OR ct.container_number=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found.' });

    // Build movement timeline
    const txn = rows[0];
    const timeline = [
      txn.arrival_time         && { status: 'ARRIVED_AT_BOOTH',        time: txn.arrival_time,          label: 'Arrived at Booth' },
      txn.bay_assigned_time    && { status: 'BAY_ASSIGNED',             time: txn.bay_assigned_time,     label: 'Bay Assigned' },
      txn.bay_entry_time       && { status: 'ARRIVED_AT_BAY',           time: txn.bay_entry_time,        label: 'Arrived at Bay' },
      txn.examination_start_time && { status: 'UNDER_EXAMINATION',      time: txn.examination_start_time, label: 'Examination Started' },
      txn.examination_end_time && { status: 'EXAMINATION_COMPLETED',    time: txn.examination_end_time,  label: 'Examination Completed' },
      txn.time_out             && { status: 'EXITED',                   time: txn.time_out,              label: 'Truck Released / Exited' },
    ].filter(Boolean);

    return res.json({ ...txn, timeline });
  } catch (err) { next(err); }
}

// ─── Override / Correct (Supervisor) ─────────────────────────────────────────
async function override(req, res, next) {
  try {
    const { status, notes, agentName, agentPhone, truckNumber, driverName, driverPhone } = req.body;
    const updates = [];
    const params = [];

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` });
      }
      params.push(status); updates.push(`status=$${params.length}`);
    }
    if (notes !== undefined)       { params.push(notes);       updates.push(`notes=$${params.length}`); }
    if (agentName !== undefined)   { params.push(agentName);   updates.push(`agent_name=$${params.length}`); }
    if (agentPhone !== undefined)  { params.push(agentPhone);  updates.push(`agent_phone=$${params.length}`); }
    if (truckNumber !== undefined) { params.push(truckNumber); updates.push(`truck_number=$${params.length}`); }
    if (driverName !== undefined)  { params.push(driverName);  updates.push(`driver_name=$${params.length}`); }
    if (driverPhone !== undefined) { params.push(driverPhone); updates.push(`driver_phone=$${params.length}`); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id);
    const { rowCount } = await db.query(
      `UPDATE container_transactions SET ${updates.join(', ')}
       WHERE id::text=$${params.length} OR transaction_id=$${params.length} OR waybill_number=$${params.length}`,
      params
    );
    if (!rowCount) return res.status(404).json({ error: 'Transaction not found.' });

    await logAudit(req, 'container:overridden', 'container_transaction', req.params.id, req.body);
    return res.json({ message: 'Transaction updated.' });
  } catch (err) { next(err); }
}

// ─── Reinstate Container (Admin only) ────────────────────────────────────────
async function reinstateContainer(req, res, next) {
  try {
    const { id } = req.params;
    const { reinstateToStatus, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to reinstate a container.' });
    }

    // Fetch the transaction
    const { rows } = await db.query(
      `SELECT ct.*, ha.name AS area_name, b.bay_code
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
       LEFT JOIN bays b ON b.id = ct.bay_id
       WHERE ct.id::text=$1 OR ct.transaction_id=$1`,
      [id]
    );
    const txn = rows[0];
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });

    if (!['EXITED', 'CANCELLED'].includes(txn.status)) {
      return res.status(409).json({ error: `Only EXITED or CANCELLED containers can be reinstated. Current status: ${txn.status}.` });
    }

    // Determine which status to reinstate to
    const validReinstateTo = ['EXAMINATION_COMPLETED', 'UNDER_EXAMINATION', 'ARRIVED_AT_BAY', 'ARRIVED_AT_BOOTH'];
    const targetStatus = reinstateToStatus && validReinstateTo.includes(reinstateToStatus)
      ? reinstateToStatus
      : 'EXAMINATION_COMPLETED';

    await db.query(
      `UPDATE container_transactions
       SET status=$1, time_out=NULL, dwell_minutes=NULL,
           confirmed_exit_by=NULL, released_by=NULL,
           notes=COALESCE(notes || E'\n', '') || $2
       WHERE id=$3`,
      [targetStatus, `[REINSTATED by ${req.user.username} on ${new Date().toISOString()}] Reason: ${reason}`, txn.id]
    );

    await logAudit(req, 'container:reinstated', 'container_transaction', txn.id, {
      containerNumber: txn.container_number,
      waybillNumber: txn.waybill_number,
      previousStatus: txn.status,
      reinstatedTo: targetStatus,
      reason,
    });

    const io = req.app.get('io');
    if (io) io.to('operations').emit('transaction:updated', { id: txn.id, status: targetStatus });

    return res.json({
      message: `Container reinstated to ${targetStatus}.`,
      transactionId: txn.transaction_id,
      containerNumber: txn.container_number,
      previousStatus: txn.status,
      currentStatus: targetStatus,
    });
  } catch (err) { next(err); }
}

// ─── QR Verify (public) ───────────────────────────────────────────────────────
async function verifyQR(req, res, next) {
  try {
    const payload = verifyQRToken(req.params.token);
    if (!payload) return res.status(400).json({ error: 'Invalid or expired QR code.' });

    const { rows } = await db.query(
      `SELECT ct.transaction_id, ct.waybill_number, ct.container_number,
              ct.agent_name, ct.truck_number, ct.status,
              ct.arrival_time, ct.bay_assigned_time, ct.bay_entry_time,
              ct.examination_start_time, ct.examination_end_time, ct.time_out,
              ha.name AS area_name, b.bay_code
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
       LEFT JOIN bays b ON b.id = ct.bay_id
       WHERE ct.transaction_id=$1`,
      [payload.txn]
    );
    if (!rows.length) return res.status(404).json({ error: 'Transaction not found.' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Holding Area list ────────────────────────────────────────────────────────
async function listHoldingAreas(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT ha.*, COUNT(b.id) AS total_bays,
         (SELECT COUNT(*) FROM container_transactions ct
          WHERE ct.holding_area_id=ha.id AND ct.status=ANY($1)) AS occupied
       FROM holding_areas ha
       LEFT JOIN bays b ON b.holding_area_id=ha.id AND b.is_active=TRUE
       WHERE ha.is_active=TRUE
       GROUP BY ha.id ORDER BY ha.name`,
      [ACTIVE_STATUSES]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Bays View ────────────────────────────────────────────────────────────────
async function baysView(req, res, next) {
  try {
    const { rows: areas } = await db.query(
      `SELECT ha.id, ha.name, ha.code FROM holding_areas ha WHERE ha.is_active=TRUE ORDER BY ha.name`
    );
    const { rows: bays } = await db.query(
      `SELECT b.id, b.bay_code, b.holding_area_id, b.capacity FROM bays b WHERE b.is_active=TRUE ORDER BY b.holding_area_id, b.bay_code`
    );

    const { rows: cfg } = await db.query("SELECT value FROM system_config WHERE key='overstay_threshold_hours'");
    const thresholdMins = parseFloat(cfg[0]?.value || 3) * 60;

    // Pull active container transactions (BAY_ASSIGNED and ARRIVED_AT_BAY)
    const { rows: ctRows } = await db.query(
      `SELECT ct.id, ct.transaction_id, ct.container_number, ct.waybill_number,
              COALESCE(ct.container_size,'20ft') AS container_size,
              ct.truck_number, ct.driver_name, ct.driver_phone,
              ct.agent_name, ct.agent_phone,
              ct.bay_id, ct.holding_area_id, ct.status,
              ct.bay_assigned_time, ct.bay_entry_time, ct.created_at,
              ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(ct.bay_entry_time, ct.bay_assigned_time, ct.created_at)))/60) AS dwell_minutes
       FROM container_transactions ct
       WHERE ct.status IN ('BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED')
         AND ct.bay_id IS NOT NULL
       ORDER BY ct.created_at DESC`
    );

    // Also pull released transactions for the released tab
    const { rows: releasedRows } = await db.query(
      `SELECT ct.id, ct.transaction_id, ct.container_number, ct.waybill_number,
              COALESCE(ct.container_size,'20ft') AS container_size,
              ct.truck_number, ct.driver_name, ct.driver_phone,
              ct.agent_name, ct.agent_phone,
              ct.bay_id, ct.holding_area_id, ct.status,
              ct.bay_assigned_time, ct.bay_entry_time, ct.time_in, ct.time_out,
              ct.dwell_minutes, ha.name AS area_name, b.bay_code
       FROM container_transactions ct
       LEFT JOIN holding_areas ha ON ha.id = ct.holding_area_id
       LEFT JOIN bays b ON b.id = ct.bay_id
       WHERE ct.status = 'EXITED'
       ORDER BY ct.time_out DESC
       LIMIT 50`
    );

    // Group active transactions by bay_id (latest per bay)
    const txByBay = {};
    for (const ct of ctRows) {
      if (!txByBay[ct.bay_id]) {
        const dwell = parseInt(ct.dwell_minutes) || 0;
        txByBay[ct.bay_id] = {
          truck_id:      ct.id,
          allocation_ref: ct.transaction_id,
          truck_number:  ct.truck_number || '—',
          driver_name:   ct.driver_name,
          driver_phone:  ct.driver_phone,
          agent_name:    ct.agent_name,
          agent_phone:   ct.agent_phone,
          bay_id:        ct.bay_id,
          holding_area_id: ct.holding_area_id,
          tx_status:     ct.status,
          bay_assigned_time: ct.bay_assigned_time,
          bay_entry_time: ct.bay_entry_time,
          dwell_minutes: dwell,
          dwell_status:  dwell > thresholdMins ? 'overstayed' : dwell > thresholdMins * 0.66 ? 'warning' : 'ok',
          containers: [{
            container_number: ct.container_number,
            container_size:   ct.container_size,
            waybill_number:   ct.waybill_number,
            status:           ct.status,
          }],
        };
      } else {
        // Second container on the same truck/bay — append to containers list
        txByBay[ct.bay_id].containers.push({
          container_number: ct.container_number,
          container_size:   ct.container_size,
          waybill_number:   ct.waybill_number,
          status:           ct.status,
        });
      }
    }

    const result = areas.map(area => ({
      ...area,
      bays: bays
        .filter(b => b.holding_area_id === area.id)
        .map(b => ({ ...b, truck: txByBay[b.id] || null, is_occupied: !!txByBay[b.id] })),
    }));

    const totalBays    = bays.length;
    const occupiedBays = Object.keys(txByBay).length;
    const activeTrucks = Object.values(txByBay);
    const stats = {
      total_bays:       totalBays,
      occupied_bays:    occupiedBays,
      free_bays:        totalBays - occupiedBays,
      total_trucks:     activeTrucks.length,
      total_containers: activeTrucks.reduce((s, t) => s + (t.containers?.length || 0), 0),
      overstayed:       activeTrucks.filter(t => t.dwell_status === 'overstayed').length,
      threshold_hours:  parseFloat(cfg[0]?.value || 3),
    };

    return res.json({ areas: result, stats, released: releasedRows });
  } catch (err) { next(err); }
}

// ─── Status Summary (for dashboard) ──────────────────────────────────────────
async function statusSummary(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT status, COUNT(*) AS count FROM container_transactions GROUP BY status`
    );
    const summary = {};
    STATUSES.forEach(s => { summary[s] = 0; });
    rows.forEach(r => { summary[r.status] = parseInt(r.count); });
    return res.json(summary);
  } catch (err) { next(err); }
}

module.exports = {
  checkIn, assignBay, allocate,
  confirmEntry, startExamination, completeExamination, confirmExit,
  listTransactions, getTransaction, override, verifyQR,
  listHoldingAreas, baysView, statusSummary,
  reinstateContainer,
  STATUSES, ACTIVE_STATUSES,
};
