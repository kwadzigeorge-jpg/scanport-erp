const db = require('../config/database');

// ─── Personnel list ───────────────────────────────────────────────────────────
async function listPersonnel(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, department, is_active FROM stores_personnel ORDER BY name ASC`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function addPersonnel(req, res, next) {
  try {
    const { name, department, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const { rows } = await db.query(
      `INSERT INTO stores_personnel (name, department, notes) VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), department?.trim() || null, notes?.trim() || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                                       AS total,
        COUNT(*) FILTER (WHERE status = 'issued')::int                     AS issued,
        COUNT(*) FILTER (WHERE status = 'returned')::int                   AS returned,
        COUNT(*) FILTER (WHERE DATE(checked_out_at) = CURRENT_DATE)::int   AS today,
        COUNT(DISTINCT personnel_id) FILTER (
          WHERE DATE(checked_out_at) >= date_trunc('month', CURRENT_DATE)
        )::int                                                              AS unique_staff_this_month
      FROM parts_checkouts
    `);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── List checkouts ───────────────────────────────────────────────────────────
async function listCheckouts(req, res, next) {
  try {
    const { status, search, personnel_id, from, to, page = 1, limit = 100 } = req.query;
    const p   = Math.max(1, parseInt(page));
    const l   = Math.min(200, parseInt(limit));
    const off = (p - 1) * l;

    const conditions = [];
    const params     = [];

    if (status && status !== 'all') {
      params.push(status); conditions.push(`pc.status = $${params.length}`);
    }
    if (personnel_id) {
      params.push(parseInt(personnel_id)); conditions.push(`pc.personnel_id = $${params.length}`);
    }
    if (from) { params.push(from); conditions.push(`DATE(pc.checked_out_at) >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`DATE(pc.checked_out_at) <= $${params.length}`); }
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
        sper.name AS personnel_name, sper.department AS personnel_department
      FROM parts_checkouts pc
      JOIN spare_parts       sp   ON sp.id   = pc.part_id
      JOIN storage_locations sl   ON sl.id   = pc.location_id
      LEFT JOIN stores_personnel sper ON sper.id = pc.personnel_id
      ${where}
      ORDER BY pc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, l, off]);

    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM parts_checkouts pc
       JOIN spare_parts sp ON sp.id = pc.part_id
       ${where}`, params
    );

    return res.json({ total: cnt.n, page: p, limit: l, rows });
  } catch (err) { next(err); }
}

// ─── Create issue (part given to personnel) ───────────────────────────────────
async function createCheckout(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { part_id, location_id, qty, personnel_id, work_order, purpose } = req.body;

    if (!part_id)                      return res.status(400).json({ error: 'part_id is required.' });
    if (!location_id)                  return res.status(400).json({ error: 'location_id is required.' });
    if (!qty || parseFloat(qty) <= 0)  return res.status(400).json({ error: 'qty must be positive.' });
    if (!personnel_id)                 return res.status(400).json({ error: 'personnel_id is required.' });

    // Resolve personnel
    const { rows: [person] } = await client.query(
      `SELECT id, name, department FROM stores_personnel WHERE id = $1 AND is_active = TRUE`, [personnel_id]
    );
    if (!person) return res.status(404).json({ error: 'Personnel not found.' });

    // Validate part
    const { rows: [part] } = await client.query(
      `SELECT * FROM spare_parts WHERE id = $1 AND status = 'ACTIVE'`, [part_id]
    );
    if (!part) return res.status(404).json({ error: 'Active part not found.' });

    // Check availability
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
      `SELECT COUNT(*)::int AS cnt FROM stock_ledger WHERE txn_ref LIKE $1`, [`INV-${dateStr}-%`]
    );
    const txn_ref   = `INV-${dateStr}-${String(refRow.cnt + 1).padStart(4, '0')}`;
    const qty_after = on_hand - qtyNum;
    const unit_cost = parseFloat(bal?.weighted_avg_cost || part.unit_cost);

    // STOCK_OUT ledger entry
    await client.query(
      `INSERT INTO stock_ledger
         (part_id, location_id, txn_type, txn_ref, qty, unit_cost, qty_before, qty_after, purpose, notes, created_by)
       VALUES ($1,$2,'STOCK_OUT',$3,$4,$5,$6,$7,$8,$9,$10)`,
      [part_id, location_id, txn_ref, -qtyNum, unit_cost, on_hand, qty_after,
       work_order ? `ISSUE: ${work_order}` : 'ISSUE',
       `Issued to: ${person.name}${purpose ? ` — ${purpose}` : ''}`,
       req.user.id]
    );

    // Insert issue record
    const { rows: [checkout] } = await client.query(
      `INSERT INTO parts_checkouts
         (part_id, location_id, qty, officer_name, personnel_id, work_order, purpose, txn_ref, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'issued',$9)
       RETURNING *`,
      [part_id, location_id, qtyNum, person.name, person.id,
       work_order || null, purpose || null, txn_ref, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ...checkout,
      part_number: part.part_number,
      part_description: part.description,
      unit_of_measure: part.unit_of_measure,
      personnel_name: person.name,
      personnel_department: person.department,
    });
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
    if (!co)                       return res.status(404).json({ error: 'Record not found.' });
    if (co.status === 'returned')  return res.status(409).json({ error: 'Already returned.' });

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
              sper.name AS personnel_name
       FROM parts_checkouts pc
       JOIN spare_parts sp ON sp.id = pc.part_id
       LEFT JOIN stores_personnel sper ON sper.id = pc.personnel_id
       WHERE pc.id = $1`, [id]
    );
    return res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

module.exports = { listPersonnel, addPersonnel, getStats, listCheckouts, createCheckout, returnCheckout };
