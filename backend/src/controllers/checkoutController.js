const db = require('../config/database');

// ─── Personnel ────────────────────────────────────────────────────────────────
async function listPersonnel(req, res, next) {
  try {
    const { department, all } = req.query;
    const params = [];
    const cond   = [];
    if (!all) cond.push('is_active = TRUE');
    if (department) { params.push(department); cond.push(`department = $${params.length}`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT id, name, department, is_active FROM stores_personnel ${where} ORDER BY name ASC`,
      params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function updatePersonnel(req, res, next) {
  try {
    const { id } = req.params;
    const { name, department, is_active } = req.body;
    const sets = []; const params = [];
    if (name       !== undefined) { params.push(name.trim());   sets.push(`name=$${params.length}`); }
    if (department !== undefined) { params.push(department);    sets.push(`department=$${params.length}`); }
    if (is_active  !== undefined) { params.push(is_active);     sets.push(`is_active=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(id);
    const { rows: [row] } = await db.query(
      `UPDATE stores_personnel SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!row) return res.status(404).json({ error: 'Not found.' });
    return res.json(row);
  } catch (err) { next(err); }
}

async function removePersonnel(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: [row] } = await db.query(
      `UPDATE stores_personnel SET is_active=FALSE WHERE id=$1 RETURNING *`, [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found.' });
    return res.json(row);
  } catch (err) { next(err); }
}

async function addPersonnel(req, res, next) {
  try {
    const { name, department, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const { rows } = await db.query(
      `INSERT INTO stores_personnel (name, department, notes) VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), department?.trim() || 'stores', notes?.trim() || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                                              AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int                           AS pending,
        COUNT(*) FILTER (WHERE status = 'issued')::int                            AS issued,
        COUNT(*) FILTER (WHERE status = 'returned')::int                          AS returned,
        COUNT(*) FILTER (WHERE DATE(COALESCE(checked_out_at, requested_at)) = CURRENT_DATE
                           AND status IN ('issued','pending'))::int               AS today
      FROM parts_checkouts
    `);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── List checkouts ───────────────────────────────────────────────────────────
async function listCheckouts(req, res, next) {
  try {
    const { status, search, from, to, page = 1, limit = 100 } = req.query;
    const p   = Math.max(1, parseInt(page));
    const l   = Math.min(200, parseInt(limit));
    const off = (p - 1) * l;

    const conditions = [];
    const params     = [];

    if (status && status !== 'all') {
      params.push(status); conditions.push(`pc.status = $${params.length}`);
    }
    if (from) { params.push(from); conditions.push(`DATE(COALESCE(pc.checked_out_at, pc.requested_at)) >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`DATE(COALESCE(pc.checked_out_at, pc.requested_at)) <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        req.name       ILIKE $${params.length} OR
        ful.name       ILIKE $${params.length} OR
        sp.part_number ILIKE $${params.length} OR
        sp.description ILIKE $${params.length} OR
        pc.work_order  ILIKE $${params.length} OR
        pc.ref         ILIKE $${params.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT
        pc.*,
        sp.part_number, sp.description AS part_description, sp.unit_of_measure,
        sl.code AS location_code,
        req.name AS requested_by_name, req.department AS requested_by_dept,
        ful.name AS fulfilled_by_name
      FROM parts_checkouts pc
      JOIN  spare_parts       sp  ON sp.id  = pc.part_id
      LEFT JOIN storage_locations sl  ON sl.id  = pc.location_id
      LEFT JOIN stores_personnel  req ON req.id = pc.requested_by_id
      LEFT JOIN stores_personnel  ful ON ful.id = pc.fulfilled_by_id
      ${where}
      ORDER BY
        CASE WHEN pc.status = 'pending' THEN 0 ELSE 1 END,
        COALESCE(pc.requested_at, pc.created_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, l, off]);

    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM parts_checkouts pc
       JOIN spare_parts sp ON sp.id = pc.part_id
       LEFT JOIN stores_personnel req ON req.id = pc.requested_by_id
       LEFT JOIN stores_personnel ful ON ful.id = pc.fulfilled_by_id
       ${where}`, params
    );

    return res.json({ total: cnt.n, page: p, limit: l, rows });
  } catch (err) { next(err); }
}

// ─── Create part request (MDE → pending) ─────────────────────────────────────
async function createRequest(req, res, next) {
  try {
    const { part_id, qty, requested_by_id, work_order, purpose, urgency = 'normal' } = req.body;

    if (!part_id)                      return res.status(400).json({ error: 'part_id is required.' });
    if (!qty || parseFloat(qty) <= 0)  return res.status(400).json({ error: 'qty must be positive.' });
    if (!requested_by_id)              return res.status(400).json({ error: 'requested_by_id is required.' });

    const { rows: [person] } = await db.query(
      `SELECT id, name, department FROM stores_personnel WHERE id = $1 AND is_active = TRUE`,
      [requested_by_id]
    );
    if (!person) return res.status(404).json({ error: 'Requester not found.' });

    const { rows: [part] } = await db.query(
      `SELECT * FROM spare_parts WHERE id = $1 AND status = 'ACTIVE'`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Part not found.' });

    const { rows: [row] } = await db.query(
      `INSERT INTO parts_checkouts
         (part_id, qty, requested_by_id, personnel_id, officer_name,
          work_order, purpose, urgency, status, requested_at, created_by)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,'pending',NOW(),$8)
       RETURNING *`,
      [part_id, parseFloat(qty), requested_by_id, person.name,
       work_order || null, purpose || null, urgency, req.user.id]
    );

    return res.status(201).json({
      ...row,
      part_number:       part.part_number,
      part_description:  part.description,
      unit_of_measure:   part.unit_of_measure,
      requested_by_name: person.name,
      requested_by_dept: person.department,
    });
  } catch (err) { next(err); }
}

// ─── Fulfill request (Stores → issued, stock deducted) ───────────────────────
async function fulfillRequest(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { location_id, fulfilled_by_id, qty: overrideQty, notes } = req.body;

    if (!location_id)     return res.status(400).json({ error: 'location_id is required.' });
    if (!fulfilled_by_id) return res.status(400).json({ error: 'fulfilled_by_id is required.' });

    const { rows: [co] } = await client.query(
      `SELECT pc.*, sp.unit_of_measure, sp.unit_cost AS part_cost, sp.part_number, sp.description
       FROM parts_checkouts pc JOIN spare_parts sp ON sp.id = pc.part_id
       WHERE pc.id = $1 FOR UPDATE`, [id]
    );
    if (!co)                     return res.status(404).json({ error: 'Request not found.' });
    if (co.status !== 'pending') return res.status(409).json({ error: 'Only pending requests can be fulfilled.' });

    const { rows: [person] } = await client.query(
      `SELECT id, name FROM stores_personnel WHERE id = $1 AND is_active = TRUE`, [fulfilled_by_id]
    );
    if (!person) return res.status(404).json({ error: 'Fulfilling person not found.' });

    const qtyNum = parseFloat(overrideQty || co.qty);
    if (qtyNum <= 0) return res.status(400).json({ error: 'Qty must be positive.' });

    const { rows: [bal] } = await client.query(
      `SELECT qty_on_hand, qty_reserved, weighted_avg_cost
       FROM stock_balances WHERE part_id = $1 AND location_id = $2 FOR UPDATE`,
      [co.part_id, location_id]
    );
    const on_hand   = parseFloat(bal?.qty_on_hand  || 0);
    const reserved  = parseFloat(bal?.qty_reserved || 0);
    const available = on_hand - reserved;

    if (available < qtyNum) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Insufficient stock. Available: ${available} ${co.unit_of_measure}, requested: ${qtyNum}`,
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [refRow] } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM stock_ledger WHERE txn_ref LIKE $1`, [`INV-${dateStr}-%`]
    );
    const txn_ref   = `INV-${dateStr}-${String(refRow.cnt + 1).padStart(4, '0')}`;
    const qty_after = on_hand - qtyNum;
    const unit_cost = parseFloat(bal?.weighted_avg_cost || co.part_cost);

    await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, purpose, notes, created_by)
       VALUES ($1,$2,'STOCK_OUT',$3,$4,$5,$6,$7,$8,$9,$10)`,
      [co.part_id, location_id, txn_ref, -qtyNum, unit_cost, on_hand, qty_after,
       co.work_order ? 'WORK_ORDER' : null,
       `Issued to ${co.officer_name} — WO: ${co.work_order || 'N/A'} — picked by ${person.name}${notes ? ` (${notes})` : ''}`,
       req.user.id]
    );

    await client.query(
      `UPDATE parts_checkouts
       SET status='issued', location_id=$1, fulfilled_by_id=$2, qty=$3,
           txn_ref=$4, checked_out_at=NOW(), updated_at=NOW()
       WHERE id=$5`,
      [location_id, fulfilled_by_id, qtyNum, txn_ref, id]
    );

    await client.query('COMMIT');

    const { rows: [full] } = await db.query(
      `SELECT pc.*,
              sp.part_number, sp.description AS part_description, sp.unit_of_measure,
              sl.code AS location_code,
              req.name AS requested_by_name, req.department AS requested_by_dept,
              ful.name AS fulfilled_by_name
       FROM parts_checkouts pc
       JOIN spare_parts sp ON sp.id = pc.part_id
       LEFT JOIN storage_locations sl  ON sl.id  = pc.location_id
       LEFT JOIN stores_personnel  req ON req.id = pc.requested_by_id
       LEFT JOIN stores_personnel  ful ON ful.id = pc.fulfilled_by_id
       WHERE pc.id = $1`, [id]
    );
    return res.json(full);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

// ─── Return (wrong/excess parts only) ────────────────────────────────────────
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
    if (!co)                     return res.status(404).json({ error: 'Record not found.' });
    if (co.status !== 'issued')  return res.status(409).json({ error: 'Only issued parts can be returned.' });

    const qtyBack = parseFloat(qty_returned ?? co.qty);
    if (qtyBack <= 0 || qtyBack > parseFloat(co.qty)) {
      return res.status(400).json({ error: `Return qty must be between 0 and ${co.qty}.` });
    }

    if (return_condition !== 'lost' && qtyBack > 0) {
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
         `RETURN from ${co.officer_name} (${co.ref}) — ${return_condition}${return_notes ? `: ${return_notes}` : ''}`,
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
      `SELECT pc.*, sp.part_number, sp.description AS part_description, sp.unit_of_measure,
              req.name AS requested_by_name, ful.name AS fulfilled_by_name
       FROM parts_checkouts pc
       JOIN spare_parts sp ON sp.id = pc.part_id
       LEFT JOIN stores_personnel req ON req.id = pc.requested_by_id
       LEFT JOIN stores_personnel ful ON ful.id = pc.fulfilled_by_id
       WHERE pc.id = $1`, [id]
    );
    return res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

module.exports = {
  listPersonnel, addPersonnel, updatePersonnel, removePersonnel,
  getStats, listCheckouts, createRequest, fulfillRequest, returnCheckout,
};
