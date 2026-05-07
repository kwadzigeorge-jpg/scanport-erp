const db   = require('../config/database');
const XLSX = require('xlsx');

const OVERDUE_DAYS = 21;

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, parseInt(limit) || 25);
  return { limit: l, offset: (p - 1) * l, page: p };
}

async function getDashboard(req, res, next) {
  try {
    const { rows: kpi } = await db.query(`
      SELECT
        COUNT(*)::int                                                                        AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int                                        AS open,
        COUNT(*) FILTER (WHERE status = 'under_investigation')::int                         AS investigating,
        COUNT(*) FILTER (WHERE status = 'resolved')::int                                    AS resolved,
        COUNT(*) FILTER (WHERE status = 'escalated')::int                                   AS escalated,
        COUNT(*) FILTER (
          WHERE status NOT IN ('resolved','withdrawn','closed')
            AND (CURRENT_DATE - date_raised) > $1
        )::int                                                                               AS overdue
      FROM grievances
    `, [OVERDUE_DAYS]);

    const { rows: byType } = await db.query(`
      SELECT grievance_type, COUNT(*)::int AS count
      FROM grievances
      GROUP BY grievance_type
      ORDER BY count DESC
    `);

    const { rows: byDept } = await db.query(`
      SELECT department, COUNT(*)::int AS count
      FROM grievances
      GROUP BY department
      ORDER BY count DESC
      LIMIT 10
    `);

    const { rows: recent } = await db.query(`
      SELECT id, ref, is_anonymous, employee_name, department,
             grievance_type, status, priority, date_raised,
             (CURRENT_DATE - date_raised) AS days_open, is_overdue
      FROM grievances
      ORDER BY date_raised DESC, created_at DESC
      LIMIT 10
    `);

    return res.json({ kpi: kpi[0], byType, byDept, recent });
  } catch (err) { next(err); }
}

async function listGrievances(req, res, next) {
  try {
    const { status, type, department, search, from, to, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = []; const params = [];

    if (status)     { params.push(status);           conditions.push(`g.status=$${params.length}`); }
    if (type)       { params.push(type);              conditions.push(`g.grievance_type=$${params.length}`); }
    if (department) { params.push(`%${department}%`); conditions.push(`g.department ILIKE $${params.length}`); }
    if (from)       { params.push(from);              conditions.push(`g.date_raised>=$${params.length}`); }
    if (to)         { params.push(to);                conditions.push(`g.date_raised<=$${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(g.ref ILIKE $${params.length} OR g.employee_name ILIKE $${params.length} OR g.department ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT g.id, g.ref, g.is_anonymous, g.employee_name, g.department,
             g.grievance_type, g.status, g.priority, g.date_raised,
             (CURRENT_DATE - g.date_raised) AS days_open,
             g.assigned_to_name, g.is_overdue, g.created_at
      FROM grievances g
      ${where}
      ORDER BY g.date_raised DESC, g.created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM grievances g ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: p, limit: l, rows });
  } catch (err) { next(err); }
}

async function getGrievance(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`
      SELECT g.*, (CURRENT_DATE - g.date_raised) AS days_open,
             u.full_name AS created_by_name
      FROM grievances g
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.id = $1
    `, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Grievance not found.' });

    const { rows: activities } = await db.query(`
      SELECT a.*, u.full_name AS created_by_name
      FROM grievance_activities a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.grievance_id = $1
      ORDER BY a.created_at ASC
    `, [id]);

    return res.json({ ...rows[0], activities });
  } catch (err) { next(err); }
}

async function createGrievance(req, res, next) {
  try {
    const { is_anonymous, employee_name, department, grievance_type, priority, description, date_raised } = req.body;
    const name = is_anonymous ? 'Anonymous' : (employee_name || '').trim();
    if (!name && !is_anonymous) return res.status(400).json({ error: 'Employee name is required.' });
    if (!department?.trim()) return res.status(400).json({ error: 'Department is required.' });
    if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });

    const { rows } = await db.query(`
      INSERT INTO grievances
        (is_anonymous, employee_name, department, grievance_type, priority, description, date_raised, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      is_anonymous || false, name, department.trim(), grievance_type || 'other',
      priority || 'normal', description.trim(),
      date_raised || new Date().toISOString().slice(0,10),
      req.user.id,
    ]);

    await db.query(`
      INSERT INTO grievance_activities (grievance_id, activity_type, new_status, note, created_by)
      VALUES ($1,'created','open',$2,$3)
    `, [rows[0].id, `Case ${rows[0].ref} submitted.`, req.user.id]);

    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateGrievance(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['employee_name','department','grievance_type','priority','description','date_raised','assigned_to_name'];
    const sets = []; const params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f] === '' ? null : req.body[f]);
        sets.push(`${f}=$${params.length}`);
      }
    });
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(req.user.id); sets.push(`updated_by=$${params.length}`);
    params.push(id);
    const { rows } = await db.query(
      `UPDATE grievances SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'Grievance not found.' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function changeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note, resolution_notes, withdrawn_reason, escalated_reason } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });

    const { rows: existing } = await db.query('SELECT * FROM grievances WHERE id=$1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Grievance not found.' });
    const g = existing[0];

    const sets = [`status=$1`, `updated_by=$2`];
    const params = [status, req.user.id];

    if (status === 'resolved') {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`resolved_date=$${params.length}`);
      if (resolution_notes) { params.push(resolution_notes); sets.push(`resolution_notes=$${params.length}`); }
    }
    if (status === 'withdrawn') {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`withdrawn_date=$${params.length}`);
      if (withdrawn_reason) { params.push(withdrawn_reason); sets.push(`withdrawn_reason=$${params.length}`); }
    }
    if (status === 'escalated') {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`escalated_date=$${params.length}`);
      if (escalated_reason) { params.push(escalated_reason); sets.push(`escalated_reason=$${params.length}`); }
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE grievances SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );

    await db.query(`
      INSERT INTO grievance_activities (grievance_id, activity_type, old_status, new_status, note, created_by)
      VALUES ($1,'status_change',$2,$3,$4,$5)
    `, [id, g.status, status, note || null, req.user.id]);

    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function addNote(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note text is required.' });

    await db.query(`
      INSERT INTO grievance_activities (grievance_id, activity_type, note, created_by)
      VALUES ($1,'note',$2,$3)
    `, [id, note.trim(), req.user.id]);

    return res.json({ ok: true });
  } catch (err) { next(err); }
}

async function checkOverdue(req, res, next) {
  try {
    const { rowCount } = await db.query(`
      UPDATE grievances
      SET is_overdue = TRUE, updated_at = NOW()
      WHERE status NOT IN ('resolved','withdrawn','closed')
        AND (CURRENT_DATE - date_raised) > $1
        AND is_overdue = FALSE
    `, [OVERDUE_DAYS]);
    return res.json({ marked: rowCount });
  } catch (err) { next(err); }
}

async function exportGrievances(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT ref, is_anonymous, employee_name, department, grievance_type,
             status, priority, date_raised,
             (CURRENT_DATE - date_raised) AS days_open,
             assigned_to_name, resolved_date, resolution_notes,
             withdrawn_reason, escalated_reason, is_overdue, created_at
      FROM grievances
      ORDER BY date_raised DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Grievances');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Grievance-Registry.xlsx"');
    return res.send(buf);
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard, listGrievances, getGrievance,
  createGrievance, updateGrievance,
  changeStatus, addNote,
  checkOverdue, exportGrievances,
};
