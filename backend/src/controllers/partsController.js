const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function generateSupplierCode(client) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM suppliers`);
  return `SUP-${String(rows[0].cnt + 1).padStart(4, '0')}`;
}

// ─── Parts ────────────────────────────────────────────────────────────────────
async function listParts(req, res, next) {
  try {
    const { category_id, criticality, status = 'ACTIVE', search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (status !== 'ALL') { params.push(status); conditions.push(`sp.status = $${params.length}`); }
    if (category_id)      { params.push(parseInt(category_id)); conditions.push(`sp.category_id = $${params.length}`); }
    if (criticality)      { params.push(criticality); conditions.push(`sp.criticality = $${params.length}`); }
    if (search)           { params.push(`%${search}%`); conditions.push(`(sp.part_number ILIKE $${params.length} OR sp.description ILIKE $${params.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT sp.id, sp.part_number, sp.description, sp.unit_of_measure,
              sp.criticality, sp.status, sp.unit_cost, sp.currency,
              sp.min_stock_level, sp.max_stock_level, sp.reorder_point,
              sp.lead_time_days, sp.has_expiry, sp.has_serial,
              pc.name AS category_name,
              s.name  AS supplier_name,
              sl.code AS location_code,
              COALESCE(SUM(sb.qty_on_hand), 0)                             AS qty_on_hand,
              COALESCE(SUM(sb.qty_reserved), 0)                            AS qty_reserved,
              COALESCE(SUM(sb.qty_on_hand - sb.qty_reserved), 0)           AS qty_available,
              COALESCE(AVG(sb.weighted_avg_cost), sp.unit_cost)            AS weighted_avg_cost,
              CASE
                WHEN COALESCE(SUM(sb.qty_on_hand), 0) = 0
                  THEN 'STOCKOUT'
                WHEN COALESCE(SUM(sb.qty_on_hand - sb.qty_reserved), 0) <= sp.reorder_point
                  THEN 'LOW_STOCK'
                WHEN sp.max_stock_level > 0
                 AND COALESCE(SUM(sb.qty_on_hand), 0) > sp.max_stock_level * 1.5
                  THEN 'EXCESS'
                ELSE 'OK'
              END AS stock_status
       FROM spare_parts sp
       LEFT JOIN part_categories  pc ON pc.id = sp.category_id
       LEFT JOIN suppliers         s ON s.id  = sp.primary_supplier_id
       LEFT JOIN storage_locations sl ON sl.id = sp.default_location_id
       LEFT JOIN stock_balances   sb ON sb.part_id = sp.id
       ${where}
       GROUP BY sp.id, pc.name, s.name, sl.code
       ORDER BY sp.part_number
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) FROM spare_parts sp ${where}`, params
    );

    return res.json({ parts: rows, total: parseInt(cnt[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

async function getPart(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: [part] } = await db.query(
      `SELECT sp.*,
              pc.name AS category_name,
              s.name  AS supplier_name,
              sl.code AS location_code
       FROM spare_parts sp
       LEFT JOIN part_categories  pc ON pc.id = sp.category_id
       LEFT JOIN suppliers         s ON s.id  = sp.primary_supplier_id
       LEFT JOIN storage_locations sl ON sl.id = sp.default_location_id
       WHERE sp.id = $1`,
      [id]
    );
    if (!part) return res.status(404).json({ error: 'Part not found.' });

    const [{ rows: suppliers }, { rows: equipment }, { rows: balances }, { rows: movements }] =
      await Promise.all([
        db.query(
          `SELECT ps.*, s.name AS supplier_name, s.contact_name, s.email, s.phone
           FROM part_suppliers ps JOIN suppliers s ON s.id = ps.supplier_id
           WHERE ps.part_id = $1`, [id]
        ),
        db.query(
          `SELECT pem.*, e.code AS equipment_code, e.name AS equipment_name, e.category AS equipment_category
           FROM part_equipment_map pem JOIN equipment e ON e.id = pem.equipment_id
           WHERE pem.part_id = $1`, [id]
        ),
        db.query(
          `SELECT sb.*, sl.code AS location_code, sl.warehouse, sl.shelf, sl.bin,
                  (sb.qty_on_hand - sb.qty_reserved) AS qty_available
           FROM stock_balances sb JOIN storage_locations sl ON sl.id = sb.location_id
           WHERE sb.part_id = $1`, [id]
        ),
        db.query(
          `SELECT sl.*, loc.code AS location_code,
                  e.name AS equipment_name,
                  u.full_name AS created_by_name
           FROM stock_ledger sl
           JOIN storage_locations loc ON loc.id = sl.location_id
           LEFT JOIN equipment e ON e.id = sl.equipment_id
           LEFT JOIN users u ON u.id = sl.created_by
           WHERE sl.part_id = $1
           ORDER BY sl.created_at DESC LIMIT 15`, [id]
        ),
      ]);

    return res.json({ ...part, suppliers, equipment, balances, recentMovements: movements });
  } catch (err) { next(err); }
}

async function createPart(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const {
      part_number, description, category_id, manufacturer,
      primary_supplier_id, unit_of_measure = 'EA', criticality = 'NON_CRITICAL',
      valuation_method = 'WAVG', unit_cost = 0, currency = 'GHS',
      min_stock_level = 0, max_stock_level = 0, reorder_point = 0,
      reorder_qty = 0, lead_time_days = 7, safety_stock = 0,
      default_location_id, has_expiry = false, has_serial = false,
      notes, suppliers = [], equipment_ids = [],
    } = req.body;

    if (!part_number?.trim()) return res.status(400).json({ error: 'Part number is required.' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });

    const { rows: [part] } = await client.query(
      `INSERT INTO spare_parts (
         part_number, description, category_id, manufacturer,
         primary_supplier_id, unit_of_measure, criticality,
         valuation_method, unit_cost, currency,
         min_stock_level, max_stock_level, reorder_point,
         reorder_qty, lead_time_days, safety_stock,
         default_location_id, has_expiry, has_serial, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        part_number.trim().toUpperCase(), description.trim(),
        category_id || null, manufacturer || null, primary_supplier_id || null,
        unit_of_measure, criticality, valuation_method, unit_cost, currency,
        min_stock_level, max_stock_level, reorder_point,
        reorder_qty, lead_time_days, safety_stock,
        default_location_id || null, has_expiry, has_serial,
        notes || null, req.user.id,
      ]
    );

    for (const sup of suppliers) {
      await client.query(
        `INSERT INTO part_suppliers (part_id, supplier_id, supplier_part_no, unit_cost, lead_time_days, is_preferred)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [part.id, sup.supplier_id, sup.supplier_part_no || null, sup.unit_cost || null, sup.lead_time_days || 7, sup.is_preferred || false]
      );
    }
    for (const eqId of equipment_ids) {
      await client.query(
        `INSERT INTO part_equipment_map (part_id, equipment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [part.id, eqId]
      );
    }

    await client.query('COMMIT');
    await logAudit(req, 'part:created', 'spare_parts', part.id, { part_number: part.part_number });
    return res.status(201).json(part);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Part number already exists.' });
    next(err);
  } finally { client.release(); }
}

async function updatePart(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { rows: [existing] } = await client.query('SELECT * FROM spare_parts WHERE id=$1', [id]);
    if (!existing) return res.status(404).json({ error: 'Part not found.' });

    const updatable = [
      'description','category_id','manufacturer','primary_supplier_id',
      'unit_of_measure','criticality','valuation_method','unit_cost',
      'min_stock_level','max_stock_level','reorder_point','reorder_qty',
      'lead_time_days','safety_stock','default_location_id',
      'has_expiry','has_serial','notes','status',
    ];
    const updates = []; const params = [];
    for (const f of updatable) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f}=$${params.length}`); }
    }
    if (!updates.length && req.body.suppliers === undefined && req.body.equipment_ids === undefined) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    let part = existing;
    if (updates.length) {
      updates.push('updated_at=NOW()');
      params.push(id);
      const { rows: [p] } = await client.query(
        `UPDATE spare_parts SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params
      );
      part = p;
    }

    if (req.body.suppliers !== undefined) {
      await client.query('DELETE FROM part_suppliers WHERE part_id=$1', [id]);
      for (const sup of req.body.suppliers) {
        await client.query(
          `INSERT INTO part_suppliers (part_id, supplier_id, supplier_part_no, unit_cost, lead_time_days, is_preferred)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, sup.supplier_id, sup.supplier_part_no || null, sup.unit_cost || null, sup.lead_time_days || 7, sup.is_preferred || false]
        );
      }
    }
    if (req.body.equipment_ids !== undefined) {
      await client.query('DELETE FROM part_equipment_map WHERE part_id=$1', [id]);
      for (const eqId of req.body.equipment_ids) {
        await client.query(
          `INSERT INTO part_equipment_map (part_id, equipment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, eqId]
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req, 'part:updated', 'spare_parts', id, { before: existing, after: part });
    return res.json(part);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

async function deletePart(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: [part] } = await db.query(
      `UPDATE spare_parts SET status='OBSOLETE', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    if (!part) return res.status(404).json({ error: 'Part not found.' });
    await logAudit(req, 'part:obsoleted', 'spare_parts', id, { part_number: part.part_number });
    return res.json({ message: 'Part marked as obsolete.', part });
  } catch (err) { next(err); }
}

// ─── Categories ───────────────────────────────────────────────────────────────
async function listCategories(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT c.*, p.name AS parent_name,
              (SELECT COUNT(*) FROM spare_parts sp WHERE sp.category_id = c.id) AS part_count
       FROM part_categories c
       LEFT JOIN part_categories p ON p.id = c.parent_id
       ORDER BY c.parent_id NULLS FIRST, c.name`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });
    const { rows: [cat] } = await db.query(
      `INSERT INTO part_categories (name, parent_id) VALUES ($1,$2) RETURNING *`,
      [name.trim(), parent_id || null]
    );
    return res.status(201).json(cat);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists.' });
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, parent_id } = req.body;
    const { rows: [cat] } = await db.query(
      `UPDATE part_categories SET
         name      = COALESCE($1, name),
         parent_id = COALESCE($2, parent_id)
       WHERE id = $3 RETURNING *`,
      [name?.trim() || null, parent_id || null, id]
    );
    if (!cat) return res.status(404).json({ error: 'Category not found.' });
    return res.json(cat);
  } catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM spare_parts WHERE category_id=$1`, [id]
    );
    if (cnt.n > 0) return res.status(409).json({ error: `Cannot delete — ${cnt.n} part(s) use this category.` });
    await db.query('DELETE FROM part_categories WHERE id=$1', [id]);
    return res.json({ message: 'Category deleted.' });
  } catch (err) { next(err); }
}

// ─── Suppliers ────────────────────────────────────────────────────────────────
async function listSuppliers(req, res, next) {
  try {
    const { search, is_active } = req.query;
    const conditions = [];
    const params = [];
    if (search)             { params.push(`%${search}%`); conditions.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`); }
    if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`s.is_active=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM part_suppliers ps WHERE ps.supplier_id=s.id) AS part_count
       FROM suppliers s ${where} ORDER BY s.name`, params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getSupplier(req, res, next) {
  try {
    const { rows: [sup] } = await db.query(`SELECT * FROM suppliers WHERE id=$1`, [req.params.id]);
    if (!sup) return res.status(404).json({ error: 'Supplier not found.' });
    const { rows: parts } = await db.query(
      `SELECT sp.part_number, sp.description, ps.unit_cost, ps.lead_time_days, ps.is_preferred
       FROM part_suppliers ps JOIN spare_parts sp ON sp.id=ps.part_id
       WHERE ps.supplier_id=$1 ORDER BY sp.part_number`, [req.params.id]
    );
    return res.json({ ...sup, parts });
  } catch (err) { next(err); }
}

async function createSupplier(req, res, next) {
  const client = await db.getClient();
  try {
    const { name, contact_name, email, phone, address, lead_time_days = 7 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Supplier name is required.' });
    const code = await generateSupplierCode(client);
    const { rows: [sup] } = await client.query(
      `INSERT INTO suppliers (code,name,contact_name,email,phone,address,lead_time_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code, name.trim(), contact_name || null, email || null, phone || null, address || null, lead_time_days]
    );
    return res.status(201).json(sup);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Supplier already exists.' });
    next(err);
  } finally { client.release(); }
}

async function updateSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const updatable = ['name','contact_name','email','phone','address','lead_time_days','rating','is_active'];
    const updates = []; const params = [];
    for (const f of updatable) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f}=$${params.length}`); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(id);
    const { rows: [sup] } = await db.query(
      `UPDATE suppliers SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!sup) return res.status(404).json({ error: 'Supplier not found.' });
    return res.json(sup);
  } catch (err) { next(err); }
}

// ─── Equipment ────────────────────────────────────────────────────────────────
async function listEquipment(req, res, next) {
  try {
    const { search, category } = req.query;
    const conditions = ['e.is_active=TRUE'];
    const params = [];
    if (search)   { params.push(`%${search}%`); conditions.push(`(e.name ILIKE $${params.length} OR e.code ILIKE $${params.length})`); }
    if (category) { params.push(category); conditions.push(`e.category=$${params.length}`); }
    const { rows } = await db.query(
      `SELECT * FROM equipment e WHERE ${conditions.join(' AND ')} ORDER BY e.code`, params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createEquipment(req, res, next) {
  try {
    const { code, name, category, manufacturer, model, serial_number, location, commissioned_at, mtbf_hours } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Equipment code is required.' });
    if (!name?.trim()) return res.status(400).json({ error: 'Equipment name is required.' });
    const { rows: [eq] } = await db.query(
      `INSERT INTO equipment (code,name,category,manufacturer,model,serial_number,location,commissioned_at,mtbf_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), category||null, manufacturer||null, model||null,
       serial_number||null, location||null, commissioned_at||null, mtbf_hours||null]
    );
    return res.status(201).json(eq);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Equipment code already exists.' });
    next(err);
  }
}

async function updateEquipment(req, res, next) {
  try {
    const { id } = req.params;
    const updatable = ['name','category','manufacturer','model','serial_number','location','commissioned_at','mtbf_hours','is_active'];
    const updates = []; const params = [];
    for (const f of updatable) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f}=$${params.length}`); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(id);
    const { rows: [eq] } = await db.query(
      `UPDATE equipment SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!eq) return res.status(404).json({ error: 'Equipment not found.' });
    return res.json(eq);
  } catch (err) { next(err); }
}

// ─── Storage Locations ────────────────────────────────────────────────────────
async function listLocations(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT *, (SELECT COUNT(*) FROM stock_balances sb WHERE sb.location_id=sl.id AND sb.qty_on_hand > 0) AS parts_stored
       FROM storage_locations sl WHERE is_active=TRUE ORDER BY code`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createLocation(req, res, next) {
  try {
    const { code, warehouse, shelf, bin, description } = req.body;
    if (!code?.trim())      return res.status(400).json({ error: 'Location code is required.' });
    if (!warehouse?.trim()) return res.status(400).json({ error: 'Warehouse is required.' });
    const { rows: [loc] } = await db.query(
      `INSERT INTO storage_locations (code,warehouse,shelf,bin,description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [code.trim().toUpperCase(), warehouse.trim(), shelf||null, bin||null, description||null]
    );
    return res.status(201).json(loc);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Location code already exists.' });
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { id } = req.params;
    const updatable = ['warehouse','shelf','bin','description','is_active'];
    const updates = []; const params = [];
    for (const f of updatable) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f}=$${params.length}`); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(id);
    const { rows: [loc] } = await db.query(
      `UPDATE storage_locations SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!loc) return res.status(404).json({ error: 'Location not found.' });
    return res.json(loc);
  } catch (err) { next(err); }
}

module.exports = {
  listParts, getPart, createPart, updatePart, deletePart,
  listCategories, createCategory, updateCategory, deleteCategory,
  listSuppliers, getSupplier, createSupplier, updateSupplier,
  listEquipment, createEquipment, updateEquipment,
  listLocations, createLocation, updateLocation,
};
