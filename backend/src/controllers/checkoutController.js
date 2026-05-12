const db = require('../config/database');

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int                                          AS active,
        COUNT(*) FILTER (WHERE status = 'active' AND expected_return_at < CURRENT_DATE)::int    AS overdue,
        COUNT(*) FILTER (WHERE DATE(returned_at) = CURRENT_DATE)::int                           AS returned_today,
        COUNT(*)::int                                                                            AS total
      FROM parts_checkouts
    `);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── List checkouts ───────────────────────────────────────────────────────────
async function listCheckouts(req, res, next) {
  try {
    const { status, search, officer_id, from, to, page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, parseInt(limit));
    const offset = (p - 1) * l;

    const conditions = [];
    const params = [];

    if (status === 'overdue') {
      conditions.push(`pc.status = 'active' AND pc.expected_return_at < CURRENT_DATE`);
    } else if (status && status !== 'all') {
      params.push(status); conditions.push(`pc.status = $${params.length}`);
    }
    if (officer_id) { params.push(officer_id); conditions.push(`pc.officer_id = $${params.length}`); }
    if (from)       { params.push(from);       conditions.push(`DATE(pc.checked_out_at) >= $${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`DATE(pc.checked_out_at) <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(pc.officer_name ILIKE $${params.length} OR sp.part_number ILIKE $${params.length} OR sp.description ILIKE $${params.length} OR pc.work_order ILIKE $${params.length} OR pc.ref ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT
        pc.*,
        sp.part_number, sp.description AS part_description, sp.unit_of_measure,
        sl.code AS location_code,
        CASE WHEN pc.status = 'active' AND pc.expected_return_at < CURRENT_DATE THEN true ELSE false END AS is_overdue
      FROM parts_checkouts pc
      JOIN spare_parts      sp ON sp.id = pc.part_id
      JOIN storage_locations sl ON sl.id = pc.location_id
      ${where}
      ORDER BY pc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, l, offset]);

    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM parts_checkouts pc JOIN spare_parts sp ON sp.id = pc.part_id ${where}`,
      params
    );

    return res.json({ total: cnt.n, page: p, limit: l, rows });
  } catch (err) { next(err); }
}

// ─── Create checkout (issue part to officer) ──────────────────────────────────
async function createCheckout(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty, officer_id, work_order, purpose, expected_return_at } = req.body;

    if (!part_id)                     return res.status(400).json({ error: 'part_id is required.' });
    if (!location_id)                 return res.status(400).json({ error: 'location_id is required.' });
    if (!qty || parseFloat(qty) <= 0) return res.status(400).json({ error: 'qty must be positive.' });
    if (!officer_id)                  return res.status(400).json({ error: 'officer_id is required.' });

    // Resolve officer name
    const { rows: [officer] } = await client.query(
      `SELECT id, full_name FROM users WHERE id = $1`, [officer_id]
    );
    if (!officer) return res.status(404).json({ error: 'Officer not found.' });

    // Validate part
    const { rows: [part] } = await client.query(
      `SELECT * FROM spare_parts WHERE id = $1 AND status = 'ACTIVE'`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Active part not found.' });

    // Check stock availability
    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, qty_reserved, weighted_avg_cost
       FROM stock_balances WHERE part_id = $1 AND location_id = $2 FOR UPDATE`,
      [part_id, location_id]
    );
    const on_hand   = parseFloat(bal?.qty_on_hand  || 0);
    const reserved  = parseFloat(bal?.qty_reserved || 0);
    const available = on_hand - reserved;
    const qtyNum    = parseFloat(qty);

    if (available < qtyNum) {
      return res.status(409).json({
        error: `Insufficient stock. Available: ${available} ${part.unit_of_measure}, requested: ${qtyNum}`,
      });
    }

    // Generate stock ledger ref
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [refRow] } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM stock_ledger WHERE txn_ref LIKE $1`,
      [`INV-${dateStr}-%`]
    );
    const txn_ref  = `INV-${dateStr}-${String(refRow.cnt + 1).padStart(4, '0')}`;
    const qty_after = on_hand - qtyNum;
    const unit_cost = parseFloat(bal?.weighted_avg_cost || part.unit_cost);

    // Insert STOCK_OUT into ledger
    await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, purpose, notes, created_by)
       VALUES ($1,$2,'STOCK_OUT',$3,$4,$5,$6,$7,$8,$9,$10)`,
      [part_id, location_id, txn_ref, -qtyNum, unit_cost, on_hand, qty_after,
       `CHECKOUT${work_order ? `: ${work_order}` : ''}`,
       `Issued to: ${officer.full_name}${purpose ? ` — ${purpose}` : ''}`,
       req.user.id]
    );

    // Insert checkout record
    const { rows: [checkout] } = await client.query(
      `INSERT INTO parts_checkouts
         (part_id, location_id, qty, officer_id, officer_name, work_order, purpose, expected_return_at, txn_ref, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [part_id, location_id, qtyNum, officer_id, officer.full_name,
       work_order || null, purpose || null,
       expected_return_at || null, txn_ref, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ...checkout,
      part_number: part.part_number,
      part_description: part.description,
      unit_of_measure: part.unit_of_measure,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Return a checkout ────────────────────────────────────────────────────────
async function returnCheckout(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { qty_returned, return_condition = 'good', return_notes } = req.body;

    const { rows: [co] } = await client.query(
      `SELECT pc.*, sp.unit_of_measure, sp.unit_cost AS part_cost
       FROM parts_checkouts pc JOIN spare_parts sp ON sp.id = pc.part_id
       WHERE pc.id = $1 FOR UPDATE`, [id]
    );
    if (!co)                        return res.status(404).json({ error: 'Checkout not found.' });
    if (co.status === 'returned')   return res.status(409).json({ error: 'Already returned.' });

    const qtyBack  = parseFloat(qty_returned ?? co.qty);
    if (qtyBack <= 0 || qtyBack > parseFloat(co.qty)) {
      return res.status(400).json({ error: `Return qty must be between 0 and ${co.qty}.` });
    }

    // Only re-stock if condition allows
    const restock = !['lost'].includes(return_condition) && qtyBack > 0;

    if (restock) {
      const { rows: [bal] } = await client.query(
        `SELECT qty_on_hand, weighted_avg_cost FROM stock_balances WHERE part_id=$1 AND location_id=$2`,
        [co.part_id, co.location_id]
      );
      const qty_before = parseFloat(bal?.qty_on_hand || 0);
      const qty_after  = qty_before + qtyBack;
      const unit_cost  = parseFloat(bal?.weighted_avg_cost || co.part_cost);

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { rows: [refRow] } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM stock_ledger WHERE txn_ref LIKE $1`, [`INV-${dateStr}-%`]
      );
      const return_txn_ref = `INV-${dateStr}-${String(refRow.cnt + 1).padStart(4, '0')}`;

      await client.query(
        `INSERT INTO stock_ledger
           (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, notes, created_by)
         VALUES ($1,$2,'RETURN',$3,$4,$5,$6,$7,$8,$9)`,
        [co.part_id, co.location_id, return_txn_ref, qtyBack, unit_cost, qty_before, qty_after,
         `RETURN from ${co.officer_name} (${co.ref}) — Condition: ${return_condition}${return_notes ? ` — ${return_notes}` : ''}`,
         req.user.id]
      );

      await client.query(
        `UPDATE parts_checkouts
         SET status='returned', returned_at=NOW(), qty_returned=$1,
             return_condition=$2, return_notes=$3, return_txn_ref=$4, updated_at=NOW()
         WHERE id=$5`,
        [qtyBack, return_condition, return_notes || null, return_txn_ref, id]
      );
    } else {
      await client.query(
        `UPDATE parts_checkouts
         SET status='lost', returned_at=NOW(), qty_returned=0,
             return_condition='lost', return_notes=$1, updated_at=NOW()
         WHERE id=$2`,
        [return_notes || null, id]
      );
    }

    await client.query('COMMIT');
    const { rows: [updated] } = await db.query(
      `SELECT pc.*, sp.part_number, sp.description AS part_description, sp.unit_of_measure
       FROM parts_checkouts pc JOIN spare_parts sp ON sp.id = pc.part_id WHERE pc.id = $1`, [id]
    );
    return res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

module.exports = { getStats, listCheckouts, createCheckout, returnCheckout };
