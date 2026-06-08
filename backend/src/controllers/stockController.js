const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ─── Transaction reference generator ─────────────────────────────────────────
async function generateInvRef(client) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM stock_ledger WHERE txn_ref LIKE $1`,
    [`INV-${dateStr}-%`]
  );
  return `INV-${dateStr}-${String(rows[0].cnt + 1).padStart(4, '0')}`;
}

// ─── Alert maintenance after a movement ──────────────────────────────────────
async function syncAlerts(partId, client) {
  const { rows: [sp] } = await client.query(
    `SELECT sp.reorder_point, sp.max_stock_level, sp.criticality,
            COALESCE(SUM(sb.qty_on_hand), 0)                   AS total_qty,
            COALESCE(SUM(sb.qty_on_hand - sb.qty_reserved), 0) AS avail_qty
     FROM spare_parts sp
     LEFT JOIN stock_balances sb ON sb.part_id = sp.id
     WHERE sp.id = $1 GROUP BY sp.id`,
    [partId]
  );
  if (!sp) return;

  const total = parseFloat(sp.total_qty);
  const avail = parseFloat(sp.avail_qty);
  const rop   = parseFloat(sp.reorder_point);
  const max   = parseFloat(sp.max_stock_level);
  const severityMap = { CRITICAL: 'CRITICAL', IMPORTANT: 'HIGH', NON_CRITICAL: 'MEDIUM' };
  const sev = severityMap[sp.criticality] || 'MEDIUM';

  // Resolve stale low-stock / stockout alerts when stock is healthy again
  if (avail > rop) {
    await client.query(
      `UPDATE reorder_alerts
       SET is_resolved=TRUE, resolved_at=NOW()
       WHERE part_id=$1 AND alert_type IN ('LOW_STOCK','STOCKOUT') AND is_resolved=FALSE`,
      [partId]
    );
  }

  if (total === 0) {
    await client.query(
      `INSERT INTO reorder_alerts (part_id, alert_type, current_qty, threshold_qty, severity)
       VALUES ($1,'STOCKOUT',$2,0,'CRITICAL')
       ON CONFLICT DO NOTHING`,
      [partId, total]
    );
  } else if (avail <= rop && rop > 0) {
    await client.query(
      `INSERT INTO reorder_alerts (part_id, alert_type, current_qty, threshold_qty, severity)
       VALUES ($1,'LOW_STOCK',$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [partId, avail, rop, sev]
    );
  }

  if (max > 0 && total > max * 1.5) {
    await client.query(
      `INSERT INTO reorder_alerts (part_id, alert_type, current_qty, threshold_qty, severity)
       VALUES ($1,'EXCESS_STOCK',$2,$3,'LOW')
       ON CONFLICT DO NOTHING`,
      [partId, total, max]
    );
  }
}

// ─── Current balances (all parts) ────────────────────────────────────────────
async function getBalances(req, res, next) {
  try {
    const { criticality, stock_status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [`sp.status = 'ACTIVE'`];
    const params = [];

    if (criticality) { params.push(criticality); conditions.push(`sp.criticality=$${params.length}`); }
    if (search)      { params.push(`%${search}%`); conditions.push(`(sp.part_number ILIKE $${params.length} OR sp.description ILIKE $${params.length})`); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // stock_status filter applied as HAVING clause
    const havingMap = {
      STOCKOUT:  `COALESCE(SUM(sb.qty_on_hand),0) = 0`,
      LOW_STOCK: `COALESCE(SUM(sb.qty_on_hand),0) > 0 AND COALESCE(SUM(sb.qty_on_hand-sb.qty_reserved),0) <= sp.reorder_point`,
      EXCESS:    `sp.max_stock_level > 0 AND COALESCE(SUM(sb.qty_on_hand),0) > sp.max_stock_level * 1.5`,
      OK:        `COALESCE(SUM(sb.qty_on_hand),0) > 0 AND COALESCE(SUM(sb.qty_on_hand-sb.qty_reserved),0) > sp.reorder_point`,
    };
    const having = stock_status && havingMap[stock_status] ? `HAVING ${havingMap[stock_status]}` : '';

    params.push(parseInt(limit), offset);
    const limitIdx = params.length - 1;

    const { rows } = await db.query(
      `SELECT sp.id, sp.part_number, sp.description, sp.unit_of_measure,
              sp.criticality, sp.reorder_point, sp.min_stock_level, sp.max_stock_level,
              sp.unit_cost, sp.currency, sp.lead_time_days,
              pc.name AS category_name,
              COALESCE(SUM(sb.qty_on_hand), 0)                             AS qty_on_hand,
              COALESCE(SUM(sb.qty_reserved), 0)                            AS qty_reserved,
              COALESCE(SUM(sb.qty_on_hand - sb.qty_reserved), 0)           AS qty_available,
              COALESCE(AVG(sb.weighted_avg_cost), sp.unit_cost)            AS weighted_avg_cost,
              COALESCE(SUM(sb.qty_on_hand) * AVG(COALESCE(sb.weighted_avg_cost, sp.unit_cost)), 0) AS total_value,
              MAX(sb.last_movement)                                         AS last_movement,
              EXISTS(SELECT 1 FROM reorder_alerts ra WHERE ra.part_id=sp.id AND ra.is_resolved=FALSE) AS has_alert
       FROM spare_parts sp
       LEFT JOIN part_categories  pc ON pc.id = sp.category_id
       LEFT JOIN stock_balances   sb ON sb.part_id = sp.id
       ${where}
       GROUP BY sp.id, pc.name
       ${having}
       ORDER BY sp.criticality DESC, sp.part_number
       LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
      params
    );

    const { rows: [summary] } = await db.query(
      `SELECT
         COUNT(DISTINCT sp.id)::int                                                                AS total_parts,
         SUM(CASE WHEN COALESCE(agg.qty,0)=0 THEN 1 ELSE 0 END)::int                             AS stockout_count,
         SUM(CASE WHEN COALESCE(agg.qty,0)>0 AND COALESCE(agg.avail,0)<=sp.reorder_point THEN 1 ELSE 0 END)::int AS low_stock_count,
         COALESCE(SUM(COALESCE(agg.qty,0) * COALESCE(agg.cost, sp.unit_cost)), 0)                AS total_inventory_value
       FROM spare_parts sp
       LEFT JOIN (
         SELECT part_id, SUM(qty_on_hand) AS qty, SUM(qty_on_hand-qty_reserved) AS avail, AVG(weighted_avg_cost) AS cost
         FROM stock_balances GROUP BY part_id
       ) agg ON agg.part_id = sp.id
       WHERE sp.status='ACTIVE'`
    );

    return res.json({ balances: rows, summary, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

// ─── Stock for one part, broken down by location ──────────────────────────────
async function getPartStock(req, res, next) {
  try {
    const { partId } = req.params;
    const { rows } = await db.query(
      `SELECT sb.*,
              (sb.qty_on_hand - sb.qty_reserved) AS qty_available,
              sl.code AS location_code, sl.warehouse, sl.shelf, sl.bin
       FROM stock_balances sb
       JOIN storage_locations sl ON sl.id = sb.location_id
       WHERE sb.part_id = $1 ORDER BY sl.code`,
      [partId]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Movement ledger for one part ────────────────────────────────────────────
async function getLedger(req, res, next) {
  try {
    const { partId } = req.params;
    const { page = 1, limit = 50, txn_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [partId];
    const conditions = ['sl.part_id=$1'];
    if (txn_type) { params.push(txn_type); conditions.push(`sl.txn_type=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT sl.*,
              loc.code AS location_code, loc.warehouse,
              e.name   AS equipment_name, e.code AS equipment_code,
              u.full_name  AS created_by_name,
              ab.full_name AS approved_by_name
       FROM stock_ledger sl
       JOIN storage_locations loc ON loc.id = sl.location_id
       LEFT JOIN equipment e  ON e.id  = sl.equipment_id
       LEFT JOIN users u      ON u.id  = sl.created_by
       LEFT JOIN users ab     ON ab.id = sl.approved_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY sl.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM stock_ledger sl WHERE ${conditions.join(' AND ')}`, params
    );

    return res.json({ ledger: rows, total: cnt.n, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

// ─── Stock In ─────────────────────────────────────────────────────────────────
async function stockIn(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty, unit_cost, batch_number, serial_number, expiry_date, notes } = req.body;

    if (!part_id)                      return res.status(400).json({ error: 'part_id is required.' });
    if (!location_id)                  return res.status(400).json({ error: 'location_id is required.' });
    if (!qty || parseFloat(qty) <= 0)  return res.status(400).json({ error: 'qty must be a positive number.' });

    const { rows: [part] } = await client.query(
      `SELECT * FROM spare_parts WHERE id=$1 AND status='ACTIVE'`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Active part not found.' });

    const { rows: [loc] } = await client.query(
      `SELECT id FROM storage_locations WHERE id=$1 AND is_active=TRUE`, [location_id]
    );
    if (!loc) return res.status(404).json({ error: 'Active storage location not found.' });

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
      [part_id, location_id]
    );
    const qty_before = parseFloat(bal?.qty_on_hand || 0);
    const qty_after  = qty_before + parseFloat(qty);
    const cost       = parseFloat(unit_cost) > 0 ? parseFloat(unit_cost) : parseFloat(part.unit_cost);
    const txn_ref    = await generateInvRef(client);

    const { rows: [txn] } = await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after,
          batch_number, serial_number, expiry_date, notes, created_by)
       VALUES ($1,$2,'STOCK_IN',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [part_id, location_id, txn_ref, parseFloat(qty), cost, qty_before, qty_after,
       batch_number||null, serial_number||null, expiry_date||null, notes||null, req.user.id]
    );

    await syncAlerts(part_id, client);
    await client.query('COMMIT');

    const { rows: [newBal] } = await db.query(
      `SELECT qty_on_hand, qty_reserved, weighted_avg_cost,
              (qty_on_hand - qty_reserved) AS qty_available
       FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
      [part_id, location_id]
    );

    await logAudit(req, 'stock:received', 'stock_ledger', txn.id, { part_id, qty, txn_ref });
    return res.status(201).json({ txn, balance: newBal });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Stock Out ────────────────────────────────────────────────────────────────
async function stockOut(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty, purpose, equipment_id, notes } = req.body;

    if (!part_id)                     return res.status(400).json({ error: 'part_id is required.' });
    if (!location_id)                 return res.status(400).json({ error: 'location_id is required.' });
    if (!qty || parseFloat(qty) <= 0) return res.status(400).json({ error: 'qty must be positive.' });

    const { rows: [part] } = await client.query(
      `SELECT * FROM spare_parts WHERE id=$1 AND status='ACTIVE'`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Active part not found.' });

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, qty_reserved, weighted_avg_cost
       FROM stock_balances WHERE part_id=$1 AND location_id=$2 FOR UPDATE`,
      [part_id, location_id]
    );
    const on_hand   = parseFloat(bal?.qty_on_hand  || 0);
    const reserved  = parseFloat(bal?.qty_reserved || 0);
    const available = on_hand - reserved;

    if (available < parseFloat(qty)) {
      return res.status(409).json({
        error: `Insufficient stock. Available: ${available} ${part.unit_of_measure}, requested: ${qty}`,
      });
    }

    const txn_ref   = await generateInvRef(client);
    const qty_after = on_hand - parseFloat(qty);
    const unit_cost = parseFloat(bal?.weighted_avg_cost || part.unit_cost);

    const { rows: [txn] } = await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after,
          purpose, equipment_id, notes, created_by)
       VALUES ($1,$2,'STOCK_OUT',$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [part_id, location_id, txn_ref, -parseFloat(qty), unit_cost, on_hand, qty_after,
       purpose||null, equipment_id||null, notes||null, req.user.id]
    );

    await syncAlerts(part_id, client);
    await client.query('COMMIT');

    await logAudit(req, 'stock:issued', 'stock_ledger', txn.id, { part_id, qty, purpose, txn_ref });
    return res.status(201).json({ txn });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Stock Return ─────────────────────────────────────────────────────────────
async function stockReturn(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty, original_txn_ref, condition, notes } = req.body;

    if (!part_id || !location_id || !qty || parseFloat(qty) <= 0) {
      return res.status(400).json({ error: 'part_id, location_id, and qty are required.' });
    }

    const { rows: [part] } = await client.query(
      `SELECT * FROM spare_parts WHERE id=$1`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Part not found.' });

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, weighted_avg_cost FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
      [part_id, location_id]
    );
    const qty_before = parseFloat(bal?.qty_on_hand || 0);
    const qty_after  = qty_before + parseFloat(qty);
    const txn_ref    = await generateInvRef(client);
    const unit_cost  = parseFloat(bal?.weighted_avg_cost || part.unit_cost);

    const { rows: [txn] } = await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, notes, created_by)
       VALUES ($1,$2,'RETURN',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [part_id, location_id, txn_ref, parseFloat(qty), unit_cost, qty_before, qty_after,
       [original_txn_ref && `Orig: ${original_txn_ref}`, condition && `Condition: ${condition}`, notes].filter(Boolean).join(' | ') || null,
       req.user.id]
    );

    await syncAlerts(part_id, client);
    await client.query('COMMIT');
    await logAudit(req, 'stock:returned', 'stock_ledger', txn.id, { part_id, qty, txn_ref });
    return res.status(201).json({ txn });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Stock Adjustment (cycle count) ──────────────────────────────────────────
async function adjust(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, new_qty, reason, notes } = req.body;

    if (!part_id || !location_id) return res.status(400).json({ error: 'part_id and location_id are required.' });
    if (new_qty === undefined)    return res.status(400).json({ error: 'new_qty is required.' });
    if (!reason?.trim())          return res.status(400).json({ error: 'reason is required for adjustments.' });
    if (parseFloat(new_qty) < 0) return res.status(400).json({ error: 'new_qty cannot be negative.' });

    const { rows: [part] } = await client.query(`SELECT * FROM spare_parts WHERE id=$1`, [part_id]);
    if (!part) return res.status(404).json({ error: 'Part not found.' });

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, weighted_avg_cost FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
      [part_id, location_id]
    );
    const qty_before = parseFloat(bal?.qty_on_hand || 0);
    const qty_after  = parseFloat(new_qty);
    const variance   = qty_after - qty_before;

    if (variance === 0) return res.status(400).json({ error: 'No change from current stock level.' });

    const txn_ref   = await generateInvRef(client);
    const unit_cost = parseFloat(bal?.weighted_avg_cost || part.unit_cost);

    const { rows: [txn] } = await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after,
          purpose, notes, approved_by, approved_at, created_by)
       VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5,$6,$7,'CYCLE_COUNT',$8,$9,NOW(),$10) RETURNING *`,
      [part_id, location_id, txn_ref, variance, unit_cost, qty_before, qty_after,
       `${reason}${notes ? ' — ' + notes : ''}`, req.user.id, req.user.id]
    );

    await syncAlerts(part_id, client);
    await client.query('COMMIT');
    await logAudit(req, 'stock:adjusted', 'stock_ledger', txn.id, { part_id, qty_before, qty_after, variance, reason });
    return res.status(201).json({ txn, variance });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Transfer between locations ───────────────────────────────────────────────
async function transfer(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, from_location_id, to_location_id, qty, notes } = req.body;

    if (!part_id || !from_location_id || !to_location_id) {
      return res.status(400).json({ error: 'part_id, from_location_id, to_location_id are required.' });
    }
    if (from_location_id === to_location_id) {
      return res.status(400).json({ error: 'Source and destination must be different.' });
    }
    if (!qty || parseFloat(qty) <= 0) return res.status(400).json({ error: 'qty must be positive.' });

    const { rows: [srcBal] } = await client.query(
      `SELECT qty_on_hand, qty_reserved, weighted_avg_cost
       FROM stock_balances WHERE part_id=$1 AND location_id=$2 FOR UPDATE`,
      [part_id, from_location_id]
    );
    const avail = parseFloat(srcBal?.qty_on_hand || 0) - parseFloat(srcBal?.qty_reserved || 0);
    if (avail < parseFloat(qty)) {
      return res.status(409).json({ error: `Insufficient stock at source. Available: ${avail}` });
    }

    const { rows: [dstBal] } = await client.query(
      `SELECT qty_on_hand FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
      [part_id, to_location_id]
    );

    const txn_ref   = await generateInvRef(client);
    const src_qty   = parseFloat(srcBal.qty_on_hand);
    const dst_qty   = parseFloat(dstBal?.qty_on_hand || 0);
    const unit_cost = parseFloat(srcBal.weighted_avg_cost || 0);
    const move_qty  = parseFloat(qty);

    await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, notes, created_by)
       VALUES ($1,$2,'TRANSFER_OUT',$3,$4,$5,$6,$7,$8,$9)`,
      [part_id, from_location_id, txn_ref, -move_qty, unit_cost, src_qty, src_qty - move_qty, notes||null, req.user.id]
    );
    await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, notes, created_by)
       VALUES ($1,$2,'TRANSFER_IN',$3,$4,$5,$6,$7,$8,$9)`,
      [part_id, to_location_id, txn_ref, move_qty, unit_cost, dst_qty, dst_qty + move_qty, notes||null, req.user.id]
    );

    await client.query('COMMIT');
    await logAudit(req, 'stock:transferred', 'stock_ledger', null, { part_id, from_location_id, to_location_id, qty, txn_ref });
    return res.status(201).json({ message: 'Transfer complete.', txn_ref });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Reservations ─────────────────────────────────────────────────────────────
async function createReservation(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty_reserved, purpose, work_order_ref, reserved_until } = req.body;

    if (!part_id || !location_id || !qty_reserved) {
      return res.status(400).json({ error: 'part_id, location_id, qty_reserved are required.' });
    }

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, qty_reserved FROM stock_balances WHERE part_id=$1 AND location_id=$2 FOR UPDATE`,
      [part_id, location_id]
    );
    const available = parseFloat(bal?.qty_on_hand || 0) - parseFloat(bal?.qty_reserved || 0);
    if (available < parseFloat(qty_reserved)) {
      return res.status(409).json({ error: `Insufficient available stock. Available: ${available}` });
    }

    await client.query(
      `UPDATE stock_balances SET qty_reserved = qty_reserved + $1 WHERE part_id=$2 AND location_id=$3`,
      [parseFloat(qty_reserved), part_id, location_id]
    );

    const { rows: [resv] } = await client.query(
      `INSERT INTO stock_reservations (part_id, location_id, qty_reserved, purpose, work_order_ref, reserved_by, reserved_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [part_id, location_id, parseFloat(qty_reserved), purpose||null, work_order_ref||null, req.user.id, reserved_until||null]
    );

    await client.query('COMMIT');
    return res.status(201).json(resv);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

async function cancelReservation(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { rows: [resv] } = await client.query(
      `UPDATE stock_reservations SET status='CANCELLED' WHERE id=$1 AND status='ACTIVE' RETURNING *`, [id]
    );
    if (!resv) return res.status(404).json({ error: 'Active reservation not found.' });

    await client.query(
      `UPDATE stock_balances
       SET qty_reserved = GREATEST(0, qty_reserved - $1)
       WHERE part_id=$2 AND location_id=$3`,
      [resv.qty_reserved, resv.part_id, resv.location_id]
    );
    await client.query('COMMIT');
    return res.json({ message: 'Reservation cancelled.', reservation: resv });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

async function listReservations(req, res, next) {
  try {
    const { part_id, status = 'ACTIVE' } = req.query;
    const conditions = [`sr.status=$1`];
    const params = [status];
    if (part_id) { params.push(part_id); conditions.push(`sr.part_id=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT sr.*, sp.part_number, sp.description, sp.unit_of_measure,
              sl.code AS location_code, u.full_name AS reserved_by_name
       FROM stock_reservations sr
       JOIN spare_parts sp ON sp.id = sr.part_id
       JOIN storage_locations sl ON sl.id = sr.location_id
       JOIN users u ON u.id = sr.reserved_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY sr.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
async function getAlerts(req, res, next) {
  try {
    const { is_resolved = 'false', alert_type, severity } = req.query;
    const conditions = [`ra.is_resolved=$1`];
    const params = [is_resolved === 'true'];
    if (alert_type) { params.push(alert_type); conditions.push(`ra.alert_type=$${params.length}`); }
    if (severity)   { params.push(severity);   conditions.push(`ra.severity=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT ra.*,
              sp.part_number, sp.description, sp.criticality,
              sp.unit_of_measure, sp.reorder_point, sp.lead_time_days,
              s.name AS supplier_name, s.phone AS supplier_phone,
              COALESCE(SUM(sb.qty_on_hand), 0) AS current_qty_on_hand
       FROM reorder_alerts ra
       JOIN spare_parts sp ON sp.id = ra.part_id
       LEFT JOIN suppliers s ON s.id = sp.primary_supplier_id
       LEFT JOIN stock_balances sb ON sb.part_id = ra.part_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ra.id, sp.id, s.name, s.phone
       ORDER BY
         CASE ra.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         ra.created_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function resolveAlert(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: [alert] } = await db.query(
      `UPDATE reorder_alerts SET is_resolved=TRUE, resolved_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    return res.json(alert);
  } catch (err) { next(err); }
}

// ─── Reorder list ─────────────────────────────────────────────────────────────
async function getReorderList(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT sp.id, sp.part_number, sp.description, sp.criticality,
              sp.unit_of_measure, sp.reorder_point, sp.reorder_qty,
              sp.lead_time_days, sp.unit_cost, sp.currency,
              pc.name AS category_name,
              s.name  AS supplier_name,
              s.email AS supplier_email,
              s.phone AS supplier_phone,
              COALESCE(agg.qty_on_hand, 0)  AS qty_on_hand,
              COALESCE(agg.qty_available, 0) AS qty_available,
              sp.reorder_qty                 AS suggested_order_qty,
              sp.reorder_qty * sp.unit_cost  AS estimated_cost,
              COALESCE(cons.avg_daily, 0)    AS avg_daily_consumption
       FROM spare_parts sp
       LEFT JOIN part_categories pc ON pc.id = sp.category_id
       LEFT JOIN suppliers        s  ON s.id  = sp.primary_supplier_id
       LEFT JOIN (
         SELECT part_id,
                SUM(qty_on_hand)                   AS qty_on_hand,
                SUM(qty_on_hand - qty_reserved)    AS qty_available
         FROM stock_balances GROUP BY part_id
       ) agg ON agg.part_id = sp.id
       LEFT JOIN (
         SELECT part_id, SUM(qty_consumed) / 30.0 AS avg_daily
         FROM consumption_history
         WHERE period_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY part_id
       ) cons ON cons.part_id = sp.id
       WHERE sp.status = 'ACTIVE'
         AND sp.reorder_point > 0
         AND COALESCE(agg.qty_available, 0) <= sp.reorder_point
       ORDER BY
         CASE sp.criticality WHEN 'CRITICAL' THEN 1 WHEN 'IMPORTANT' THEN 2 ELSE 3 END,
         COALESCE(agg.qty_on_hand, 0) ASC`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Inventory reports ────────────────────────────────────────────────────────
async function getValuationReport(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT sp.part_number, sp.description, sp.unit_of_measure, sp.criticality,
              pc.name AS category,
              COALESCE(SUM(sb.qty_on_hand), 0)                                               AS qty_on_hand,
              COALESCE(AVG(sb.weighted_avg_cost), sp.unit_cost)                              AS unit_cost,
              COALESCE(SUM(sb.qty_on_hand) * AVG(COALESCE(sb.weighted_avg_cost,sp.unit_cost)),0) AS total_value
       FROM spare_parts sp
       LEFT JOIN part_categories pc ON pc.id = sp.category_id
       LEFT JOIN stock_balances  sb ON sb.part_id = sp.id
       WHERE sp.status='ACTIVE'
       GROUP BY sp.id, pc.name
       ORDER BY total_value DESC`
    );
    const { rows: [totals] } = await db.query(
      `SELECT COALESCE(SUM(sb.qty_on_hand * COALESCE(sb.weighted_avg_cost, sp.unit_cost)), 0) AS grand_total
       FROM spare_parts sp LEFT JOIN stock_balances sb ON sb.part_id=sp.id WHERE sp.status='ACTIVE'`
    );
    return res.json({ items: rows, grand_total: totals.grand_total });
  } catch (err) { next(err); }
}

async function getConsumptionReport(req, res, next) {
  try {
    const { from, to, part_id } = req.query;
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);
    const params = [dateFrom, dateTo];
    const conditions = ['ch.period_date BETWEEN $1 AND $2'];
    if (part_id) { params.push(part_id); conditions.push(`ch.part_id=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT sp.part_number, sp.description, sp.unit_of_measure, sp.criticality,
              SUM(ch.qty_consumed) AS total_consumed,
              SUM(ch.txn_count)    AS total_txns,
              SUM(ch.qty_consumed) * AVG(COALESCE(sb.weighted_avg_cost, sp.unit_cost)) AS total_cost
       FROM consumption_history ch
       JOIN spare_parts sp ON sp.id = ch.part_id
       LEFT JOIN stock_balances sb ON sb.part_id = sp.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY sp.id
       ORDER BY total_consumed DESC`,
      params
    );
    return res.json({ items: rows, from: dateFrom, to: dateTo });
  } catch (err) { next(err); }
}

async function getSlowMoversReport(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT sp.part_number, sp.description, sp.criticality, sp.unit_of_measure,
              COALESCE(SUM(sb.qty_on_hand), 0) AS qty_on_hand,
              MAX(sb.last_movement)             AS last_movement,
              COALESCE(SUM(sb.qty_on_hand) * AVG(COALESCE(sb.weighted_avg_cost,sp.unit_cost)),0) AS value_at_risk
       FROM spare_parts sp
       LEFT JOIN stock_balances sb ON sb.part_id = sp.id
       WHERE sp.status = 'ACTIVE'
       GROUP BY sp.id
       HAVING COALESCE(SUM(sb.qty_on_hand), 0) > 0
          AND (MAX(sb.last_movement) IS NULL OR MAX(sb.last_movement) < NOW() - INTERVAL '90 days')
       ORDER BY value_at_risk DESC`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Monthly Stock Movement Report ───────────────────────────────────────────
async function getMovementReport(req, res, next) {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const from       = req.query.from ? new Date(req.query.from + 'T00:00:00') : defaultFrom;
    const to         = req.query.to   ? new Date(req.query.to   + 'T23:59:59') : defaultTo;
    const categoryId = req.query.category_id || null;

    const params = [from, to];
    const catFilter = categoryId ? `AND sp.category_id = $${params.length + 1}` : '';
    if (categoryId) params.push(parseInt(categoryId));

    const { rows } = await db.query(`
      SELECT
        sp.id,
        sp.part_number,
        sp.description,
        sp.unit_of_measure,
        sp.criticality,
        sp.reorder_point,
        sp.unit_cost,
        sp.currency,
        COALESCE(pc.name, 'Uncategorised') AS category,
        COALESCE((
          SELECT SUM(sl0.qty) FROM stock_ledger sl0
          WHERE sl0.part_id = sp.id AND sl0.created_at < $1
        ), 0)::NUMERIC AS opening_qty,
        COALESCE((
          SELECT SUM(sl_in.qty) FROM stock_ledger sl_in
          WHERE sl_in.part_id = sp.id
            AND sl_in.created_at >= $1 AND sl_in.created_at <= $2
            AND sl_in.txn_type IN ('STOCK_IN','RETURN','TRANSFER_IN')
        ), 0)::NUMERIC AS stock_in,
        COALESCE((
          SELECT ABS(SUM(sl_out.qty)) FROM stock_ledger sl_out
          WHERE sl_out.part_id = sp.id
            AND sl_out.created_at >= $1 AND sl_out.created_at <= $2
            AND sl_out.txn_type IN ('STOCK_OUT','TRANSFER_OUT')
        ), 0)::NUMERIC AS stock_out,
        COALESCE((
          SELECT SUM(sl_adj.qty) FROM stock_ledger sl_adj
          WHERE sl_adj.part_id = sp.id
            AND sl_adj.created_at >= $1 AND sl_adj.created_at <= $2
            AND sl_adj.txn_type = 'ADJUSTMENT'
        ), 0)::NUMERIC AS adjustments,
        COALESCE((
          SELECT SUM(sl_c.qty) FROM stock_ledger sl_c
          WHERE sl_c.part_id = sp.id AND sl_c.created_at <= $2
        ), 0)::NUMERIC AS closing_qty
      FROM spare_parts sp
      LEFT JOIN part_categories pc ON pc.id = sp.category_id
      WHERE sp.status = 'ACTIVE' ${catFilter}
      ORDER BY COALESCE(pc.name, 'Uncategorised'), sp.part_number
    `, params);

    let rowNo = 0;
    const data = rows.map(r => {
      rowNo++;
      const closing = parseFloat(r.closing_qty);
      const rop     = parseFloat(r.reorder_point);
      const stockIn = parseFloat(r.stock_in);
      const stockOut= parseFloat(r.stock_out);
      const adj     = parseFloat(r.adjustments);
      const cost    = parseFloat(r.unit_cost);
      return {
        row_no:        rowNo,
        id:            r.id,
        part_number:   r.part_number,
        description:   r.description,
        unit_of_measure: r.unit_of_measure,
        criticality:   r.criticality,
        category:      r.category,
        reorder_point: rop,
        unit_cost:     cost,
        currency:      r.currency,
        opening_qty:   parseFloat(r.opening_qty),
        stock_in:      stockIn,
        stock_out:     stockOut,
        adjustments:   adj,
        closing_qty:   closing,
        closing_value: closing * cost,
        has_movement:  stockIn > 0 || stockOut > 0 || adj !== 0,
        stock_status:  closing === 0 ? 'STOCKOUT' : (rop > 0 && closing <= rop ? 'LOW' : 'OK'),
      };
    });

    const summary = {
      total_parts:         data.length,
      parts_with_movement: data.filter(r => r.has_movement).length,
      total_opening_qty:   data.reduce((s, r) => s + r.opening_qty, 0),
      total_stock_in:      data.reduce((s, r) => s + r.stock_in, 0),
      total_stock_out:     data.reduce((s, r) => s + r.stock_out, 0),
      total_closing_qty:   data.reduce((s, r) => s + r.closing_qty, 0),
      total_closing_value: data.reduce((s, r) => s + r.closing_value, 0),
    };

    return res.json({ period: { from, to }, parts: data, summary });
  } catch (err) { next(err); }
}

module.exports = {
  getBalances, getPartStock, getLedger,
  stockIn, stockOut, stockReturn, adjust, transfer,
  createReservation, cancelReservation, listReservations,
  getAlerts, resolveAlert,
  getReorderList,
  getValuationReport, getConsumptionReport, getSlowMoversReport,
  getMovementReport,
};
