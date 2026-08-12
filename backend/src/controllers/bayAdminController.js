const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ── Holding Areas ──────────────────────────────────────────────────────────────
async function listAreas(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT ha.id, ha.name, ha.code, ha.description, ha.is_active,
             COUNT(b.id)::int                                    AS total_bays,
             COUNT(b.id) FILTER (WHERE b.is_active)::int        AS active_bays
      FROM holding_areas ha
      LEFT JOIN bays b ON b.holding_area_id = ha.id
      GROUP BY ha.id
      ORDER BY ha.id
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function createArea(req, res, next) {
  try {
    const { name, code, description } = req.body;
    if (!name?.trim() || !code?.trim())
      return res.status(400).json({ error: 'name and code are required' });
    const { rows } = await db.query(
      'INSERT INTO holding_areas (name, code, description) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), code.trim().toUpperCase(), description?.trim() || null]
    );
    await logAudit(req, 'area.create', 'holding_area', rows[0].id, { name: rows[0].name });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Area code already exists' });
    next(err);
  }
}

async function updateArea(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    const { rows: before } = await db.query('SELECT * FROM holding_areas WHERE id=$1', [id]);
    if (!before.length) return res.status(404).json({ error: 'Area not found' });
    const { rows } = await db.query(
      `UPDATE holding_areas
       SET name        = COALESCE($1, name),
           code        = COALESCE($2, code),
           description = COALESCE($3, description)
       WHERE id = $4
       RETURNING *`,
      [name?.trim() || null, code?.trim().toUpperCase() || null, description?.trim() || null, id]
    );
    await logAudit(req, 'area.update', 'holding_area', id, { before: before[0], after: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Area code already exists' });
    next(err);
  }
}

async function toggleArea(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'UPDATE holding_areas SET is_active = NOT is_active WHERE id=$1 RETURNING *',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Area not found' });
    await logAudit(req, 'area.toggle', 'holding_area', id, { is_active: rows[0].is_active });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// ── Bays ──────────────────────────────────────────────────────────────────────
async function listBays(req, res, next) {
  try {
    const { area_id } = req.query;
    const { rows } = await db.query(`
      SELECT b.id, b.bay_code, b.capacity, b.is_active, b.is_reefer, b.holding_area_id,
             ha.name AS area_name, ha.code AS area_code,
             EXISTS (
               SELECT 1 FROM container_transactions ct
               WHERE ct.bay_id = b.id
                 AND ct.status NOT IN ('EXITED', 'CANCELLED')
             ) AS is_occupied,
             (SELECT COUNT(*)::int FROM container_transactions ct WHERE ct.bay_id = b.id) AS total_usage
      FROM bays b
      JOIN holding_areas ha ON ha.id = b.holding_area_id
      WHERE ($1::int IS NULL OR b.holding_area_id = $1)
      ORDER BY ha.id, b.bay_code
    `, [area_id ? parseInt(area_id) : null]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function createBay(req, res, next) {
  try {
    const { holding_area_id, bay_code, capacity } = req.body;
    if (!holding_area_id || !bay_code?.trim())
      return res.status(400).json({ error: 'holding_area_id and bay_code are required' });
    const { rows } = await db.query(
      'INSERT INTO bays (holding_area_id, bay_code, capacity) VALUES ($1, $2, $3) RETURNING *',
      [holding_area_id, bay_code.trim().toUpperCase(), capacity || 1]
    );
    await logAudit(req, 'bay.create', 'bay', rows[0].id, {
      bay_code: rows[0].bay_code,
      area_id: holding_area_id,
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bay code already exists in this area' });
    if (err.code === '23503') return res.status(400).json({ error: 'Holding area not found' });
    next(err);
  }
}

async function updateBay(req, res, next) {
  try {
    const { id } = req.params;
    const { bay_code, capacity, is_reefer } = req.body;
    const { rows: before } = await db.query('SELECT * FROM bays WHERE id=$1', [id]);
    if (!before.length) return res.status(404).json({ error: 'Bay not found' });
    const { rows } = await db.query(
      `UPDATE bays
       SET bay_code  = COALESCE($1, bay_code),
           capacity  = COALESCE($2, capacity),
           is_reefer = CASE WHEN $3::boolean IS NOT NULL THEN $3::boolean ELSE is_reefer END
       WHERE id = $4
       RETURNING *`,
      [bay_code?.trim().toUpperCase() || null, capacity || null,
       is_reefer !== undefined ? is_reefer : null, id]
    );
    await logAudit(req, 'bay.update', 'bay', id, { before: before[0], after: rows[0] });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bay code already exists in this area' });
    next(err);
  }
}

async function toggleBay(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      'UPDATE bays SET is_active = NOT is_active WHERE id=$1 RETURNING *',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Bay not found' });
    await logAudit(req, 'bay.toggle', 'bay', id, { is_active: rows[0].is_active });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteBay(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: used } = await db.query(
      'SELECT id FROM container_transactions WHERE bay_id=$1 LIMIT 1',
      [id]
    );
    if (used.length)
      return res.status(400).json({ error: 'Cannot delete a bay with transaction history. Deactivate it instead.' });
    const { rows } = await db.query('DELETE FROM bays WHERE id=$1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Bay not found' });
    await logAudit(req, 'bay.delete', 'bay', id, { bay_code: rows[0].bay_code });
    res.json({ message: 'Bay deleted' });
  } catch (err) { next(err); }
}

module.exports = {
  listAreas, createArea, updateArea, toggleArea,
  listBays, createBay, updateBay, toggleBay, deleteBay,
};
