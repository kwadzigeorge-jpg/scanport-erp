const db = require('../config/database');

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const { rows } = await db.query(`
      WITH active_staff AS (
        SELECT id FROM lms_staff WHERE is_active = TRUE
      ),
      latest_records AS (
        SELECT DISTINCT ON (staff_id, training_type_id)
          staff_id, training_type_id, expiry_date
        FROM staff_training_records
        ORDER BY staff_id, training_type_id, completion_date DESC
      ),
      type_count AS (SELECT COUNT(*) AS n FROM training_types WHERE is_active = TRUE),
      staff_count AS (SELECT COUNT(*) AS n FROM active_staff),
      current_count AS (
        SELECT COUNT(*) AS n FROM latest_records WHERE expiry_date > CURRENT_DATE
      ),
      expired_count AS (
        SELECT COUNT(*) AS n FROM latest_records WHERE expiry_date <= CURRENT_DATE
      ),
      due_soon_count AS (
        SELECT COUNT(*) AS n FROM latest_records
        WHERE expiry_date > CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ),
      never_trained AS (
        SELECT COUNT(*) AS n FROM (
          SELECT s.id, t.id AS tid
          FROM active_staff s
          CROSS JOIN training_types t
          WHERE t.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM latest_records lr
              WHERE lr.staff_id = s.id AND lr.training_type_id = t.id
            )
        ) x
      )
      SELECT
        (SELECT n FROM staff_count)::int   AS total_staff,
        (SELECT n FROM type_count)::int    AS total_types,
        (SELECT n FROM current_count)::int AS current_records,
        (SELECT n FROM expired_count)::int AS expired_records,
        (SELECT n FROM due_soon_count)::int AS due_soon,
        (SELECT n FROM never_trained)::int  AS never_trained
    `);

    // Per-training-type breakdown
    const { rows: byType } = await db.query(`
      SELECT
        t.id, t.name, t.code,
        COUNT(CASE WHEN lr.expiry_date > CURRENT_DATE THEN 1 END)::int AS current_count,
        COUNT(CASE WHEN lr.expiry_date <= CURRENT_DATE THEN 1 END)::int AS expired_count,
        (SELECT COUNT(*) FROM lms_staff WHERE is_active = TRUE)::int -
          COUNT(lr.staff_id)::int AS never_trained_count
      FROM training_types t
      LEFT JOIN (
        SELECT DISTINCT ON (staff_id, training_type_id)
          staff_id, training_type_id, expiry_date
        FROM staff_training_records
        ORDER BY staff_id, training_type_id, completion_date DESC
      ) lr ON lr.training_type_id = t.id
      WHERE t.is_active = TRUE
      GROUP BY t.id, t.name, t.code
      ORDER BY t.id
    `);

    res.json({ ...rows[0], by_type: byType });
  } catch (err) { next(err); }
}

// ─── Training Types ───────────────────────────────────────────────────────────
async function listTypes(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM training_types ORDER BY id`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function createType(req, res, next) {
  const { name, code, validity_months, description } = req.body;
  if (!name || !code || !validity_months) {
    return res.status(400).json({ error: 'name, code and validity_months are required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO training_types (name, code, validity_months, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, code.toUpperCase(), validity_months, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Training code already exists' });
    next(err);
  }
}

async function updateType(req, res, next) {
  const { id } = req.params;
  const { name, validity_months, description, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE training_types
       SET name = COALESCE($1, name),
           validity_months = COALESCE($2, validity_months),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [name, validity_months, description, is_active, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Training type not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Training Matrix ──────────────────────────────────────────────────────────
// Returns each active staff member with their status per training type
async function getMatrix(req, res, next) {
  try {
    const { team_id } = req.query;

    const staffQ = team_id
      ? `SELECT s.id, s.name, s.role, t.name AS team_name
         FROM lms_staff s LEFT JOIN lms_teams t ON t.id = s.team_id
         WHERE s.is_active = TRUE AND s.team_id = $1
         ORDER BY t.name, s.name`
      : `SELECT s.id, s.name, s.role, t.name AS team_name
         FROM lms_staff s LEFT JOIN lms_teams t ON t.id = s.team_id
         WHERE s.is_active = TRUE
         ORDER BY t.name, s.name`;

    const [staffRes, typesRes, recordsRes] = await Promise.all([
      db.query(staffQ, team_id ? [team_id] : []),
      db.query(`SELECT * FROM training_types WHERE is_active = TRUE ORDER BY id`),
      db.query(`
        SELECT DISTINCT ON (staff_id, training_type_id)
          staff_id, training_type_id, completion_date, expiry_date, certificate_ref
        FROM staff_training_records
        ORDER BY staff_id, training_type_id, completion_date DESC
      `),
    ]);

    const recordMap = {};
    for (const r of recordsRes.rows) {
      if (!recordMap[r.staff_id]) recordMap[r.staff_id] = {};
      recordMap[r.staff_id][r.training_type_id] = r;
    }

    const today = new Date();
    const soon = new Date(); soon.setDate(today.getDate() + 30);

    const staff = staffRes.rows.map(s => {
      const trainings = {};
      for (const t of typesRes.rows) {
        const rec = recordMap[s.id]?.[t.id];
        if (!rec) {
          trainings[t.id] = { status: 'never' };
        } else {
          const exp = new Date(rec.expiry_date);
          let status = 'current';
          if (exp <= today) status = 'expired';
          else if (exp <= soon) status = 'due_soon';
          trainings[t.id] = {
            status,
            completion_date: rec.completion_date,
            expiry_date: rec.expiry_date,
            certificate_ref: rec.certificate_ref,
          };
        }
      }
      return { ...s, trainings };
    });

    res.json({ types: typesRes.rows, staff });
  } catch (err) { next(err); }
}

// ─── Training Records ─────────────────────────────────────────────────────────
async function listRecords(req, res, next) {
  const { staff_id, training_type_id, status, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];

  if (staff_id) { conditions.push(`r.staff_id = $${params.length + 1}`); params.push(staff_id); }
  if (training_type_id) { conditions.push(`r.training_type_id = $${params.length + 1}`); params.push(training_type_id); }
  if (status === 'current')  conditions.push(`r.expiry_date > CURRENT_DATE`);
  if (status === 'expired')  conditions.push(`r.expiry_date <= CURRENT_DATE`);
  if (status === 'due_soon') conditions.push(`r.expiry_date > CURRENT_DATE AND r.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`);

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      db.query(`
        SELECT r.*, s.name AS staff_name, t.name AS team_name,
               tt.name AS training_name, tt.code AS training_code,
               u.full_name AS recorded_by_name
        FROM staff_training_records r
        JOIN lms_staff s  ON s.id  = r.staff_id
        LEFT JOIN lms_teams t ON t.id = s.team_id
        JOIN training_types tt ON tt.id = r.training_type_id
        LEFT JOIN users u ON u.id = r.recorded_by
        ${where}
        ORDER BY r.expiry_date ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      db.query(`
        SELECT COUNT(*) FROM staff_training_records r ${where}
      `, params),
    ]);
    res.json({ total: parseInt(countRows[0].count), page: +page, limit: +limit, rows });
  } catch (err) { next(err); }
}

async function createRecord(req, res, next) {
  const { staff_id, training_type_id, completion_date, certificate_ref, notes } = req.body;
  if (!staff_id || !training_type_id || !completion_date) {
    return res.status(400).json({ error: 'staff_id, training_type_id and completion_date are required' });
  }
  try {
    const { rows: typeRows } = await db.query(
      `SELECT validity_months FROM training_types WHERE id = $1`, [training_type_id]
    );
    if (!typeRows.length) return res.status(404).json({ error: 'Training type not found' });

    const expiry = new Date(completion_date);
    expiry.setMonth(expiry.getMonth() + typeRows[0].validity_months);
    const expiryDate = expiry.toISOString().split('T')[0];

    const { rows } = await db.query(`
      INSERT INTO staff_training_records
        (staff_id, training_type_id, completion_date, expiry_date, certificate_ref, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [staff_id, training_type_id, completion_date, expiryDate,
        certificate_ref || null, notes || null, req.user.id]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateRecord(req, res, next) {
  const { id } = req.params;
  const { completion_date, certificate_ref, notes } = req.body;
  try {
    let expiryDate = null;
    if (completion_date) {
      const { rows: r } = await db.query(
        `SELECT tt.validity_months FROM staff_training_records str
         JOIN training_types tt ON tt.id = str.training_type_id
         WHERE str.id = $1`, [id]
      );
      if (r.length) {
        const exp = new Date(completion_date);
        exp.setMonth(exp.getMonth() + r[0].validity_months);
        expiryDate = exp.toISOString().split('T')[0];
      }
    }
    const { rows } = await db.query(`
      UPDATE staff_training_records
      SET completion_date = COALESCE($1, completion_date),
          expiry_date     = COALESCE($2, expiry_date),
          certificate_ref = COALESCE($3, certificate_ref),
          notes           = COALESCE($4, notes),
          updated_at      = NOW()
      WHERE id = $5 RETURNING *
    `, [completion_date || null, expiryDate, certificate_ref || null, notes || null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteRecord(req, res, next) {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM staff_training_records WHERE id = $1`, [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Due / Upcoming ───────────────────────────────────────────────────────────
async function getUpcoming(req, res, next) {
  const days = parseInt(req.query.days) || 60;
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT ON (r.staff_id, r.training_type_id)
        r.id, r.staff_id, s.name AS staff_name, tm.name AS team_name,
        r.training_type_id, tt.name AS training_name, tt.code AS training_code,
        r.completion_date, r.expiry_date,
        (r.expiry_date - CURRENT_DATE) AS days_until_expiry
      FROM staff_training_records r
      JOIN lms_staff s ON s.id = r.staff_id
      LEFT JOIN lms_teams tm ON tm.id = s.team_id
      JOIN training_types tt ON tt.id = r.training_type_id
      WHERE s.is_active = TRUE
        AND r.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
      ORDER BY r.staff_id, r.training_type_id, r.completion_date DESC, r.expiry_date ASC
    `, [days]);

    // Also include staff who have never done certain trainings
    const { rows: missing } = await db.query(`
      SELECT s.id AS staff_id, s.name AS staff_name, tm.name AS team_name,
             tt.id AS training_type_id, tt.name AS training_name, tt.code AS training_code,
             NULL AS completion_date, NULL AS expiry_date,
             NULL AS days_until_expiry
      FROM lms_staff s
      CROSS JOIN training_types tt
      LEFT JOIN lms_teams tm ON tm.id = s.team_id
      WHERE s.is_active = TRUE AND tt.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM staff_training_records r
          WHERE r.staff_id = s.id AND r.training_type_id = tt.id
        )
      ORDER BY s.name, tt.name
    `);

    res.json({ expiring: rows, never_trained: missing });
  } catch (err) { next(err); }
}

// ─── Teams list (for filter) ──────────────────────────────────────────────────
async function listTeams(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, name FROM lms_teams ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard, listTypes, createType, updateType,
  getMatrix, listRecords, createRecord, updateRecord, deleteRecord,
  getUpcoming, listTeams,
};
