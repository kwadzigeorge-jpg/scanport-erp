const db   = require('../config/database');
const XLSX = require('xlsx');

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, parseInt(limit) || 25);
  return { limit: l, offset: (p - 1) * l, page: p };
}

// ─── Public: submit feedback (no auth) ───────────────────────────────────────
async function submitFeedback(req, res, next) {
  try {
    const {
      is_anonymous, submitter_name, submitter_email, submitter_phone,
      submitter_type, company_name,
      category, priority, subject, description, date_occurred,
    } = req.body;

    const name = is_anonymous ? 'Anonymous' : (submitter_name || '').trim();
    if (!name && !is_anonymous) return res.status(400).json({ error: 'Name is required.' });
    if (!subject?.trim())       return res.status(400).json({ error: 'Subject is required.' });
    if (!description?.trim())   return res.status(400).json({ error: 'Description is required.' });

    const { rows } = await db.query(`
      INSERT INTO service_feedback
        (is_anonymous, submitter_name, submitter_email, submitter_phone,
         submitter_type, company_name, category, priority,
         subject, description, date_occurred, source_ip)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id, ref, status, created_at
    `, [
      is_anonymous || false,
      name,
      submitter_email?.trim() || null,
      submitter_phone?.trim() || null,
      submitter_type || 'other',
      company_name?.trim() || null,
      category || 'other',
      priority || 'normal',
      subject.trim(),
      description.trim(),
      date_occurred || null,
      req.ip || null,
    ]);

    return res.status(201).json({ ref: rows[0].ref, id: rows[0].id });
  } catch (err) { next(err); }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const { rows: kpi } = await db.query(`
      SELECT
        COUNT(*)::int                                           AS total,
        COUNT(*) FILTER (WHERE status='new')::int              AS new,
        COUNT(*) FILTER (WHERE status='acknowledged')::int     AS acknowledged,
        COUNT(*) FILTER (WHERE status='under_review')::int     AS under_review,
        COUNT(*) FILTER (WHERE status='resolved')::int         AS resolved,
        COUNT(*) FILTER (WHERE status='closed')::int           AS closed,
        COUNT(*) FILTER (WHERE DATE(created_at)=CURRENT_DATE)::int AS today
      FROM service_feedback
    `);

    const { rows: byCategory } = await db.query(`
      SELECT category, COUNT(*)::int AS count
      FROM service_feedback GROUP BY category ORDER BY count DESC
    `);

    const { rows: byType } = await db.query(`
      SELECT submitter_type, COUNT(*)::int AS count
      FROM service_feedback GROUP BY submitter_type ORDER BY count DESC
    `);

    const { rows: recent } = await db.query(`
      SELECT id, ref, is_anonymous, submitter_name, submitter_type,
             company_name, category, priority, subject, status, created_at
      FROM service_feedback
      ORDER BY created_at DESC LIMIT 10
    `);

    return res.json({ kpi: kpi[0], byCategory, byType, recent });
  } catch (err) { next(err); }
}

// ─── List ─────────────────────────────────────────────────────────────────────
async function listFeedback(req, res, next) {
  try {
    const { status, category, submitter_type, search, from, to, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = []; const params = [];

    if (status)         { params.push(status);           conditions.push(`status=$${params.length}`); }
    if (category)       { params.push(category);         conditions.push(`category=$${params.length}`); }
    if (submitter_type) { params.push(submitter_type);   conditions.push(`submitter_type=$${params.length}`); }
    if (from)           { params.push(from);             conditions.push(`DATE(created_at)>=$${params.length}`); }
    if (to)             { params.push(to);               conditions.push(`DATE(created_at)<=$${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ref ILIKE $${params.length} OR submitter_name ILIKE $${params.length} OR company_name ILIKE $${params.length} OR subject ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT id, ref, is_anonymous, submitter_name, submitter_type,
             company_name, category, priority, subject, status,
             assigned_to_name, created_at
      FROM service_feedback ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) FROM service_feedback ${where}`, params
    );
    return res.json({ total: parseInt(cnt[0].count), page: p, limit: l, rows });
  } catch (err) { next(err); }
}

// ─── Get single ───────────────────────────────────────────────────────────────
async function getFeedback(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT f.*, u.full_name AS updated_by_name
       FROM service_feedback f
       LEFT JOIN users u ON u.id = f.updated_by
       WHERE f.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });

    const { rows: activities } = await db.query(`
      SELECT a.*, u.full_name AS created_by_name
      FROM service_feedback_activities a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.feedback_id = $1 ORDER BY a.created_at ASC
    `, [req.params.id]);

    return res.json({ ...rows[0], activities });
  } catch (err) { next(err); }
}

// ─── Change status ────────────────────────────────────────────────────────────
async function changeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note, resolution_notes, assigned_to_name } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });

    const { rows: existing } = await db.query('SELECT * FROM service_feedback WHERE id=$1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found.' });
    const old = existing[0];

    const sets = [`status=$1`, `updated_by=$2`];
    const params = [status, req.user.id];

    if (assigned_to_name !== undefined) {
      params.push(assigned_to_name || null); sets.push(`assigned_to_name=$${params.length}`);
    }
    if (status === 'resolved') {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`resolved_date=$${params.length}`);
      if (resolution_notes) { params.push(resolution_notes); sets.push(`resolution_notes=$${params.length}`); }
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE service_feedback SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );

    await db.query(`
      INSERT INTO service_feedback_activities
        (feedback_id, activity_type, old_status, new_status, note, created_by)
      VALUES ($1,'status_change',$2,$3,$4,$5)
    `, [id, old.status, status, note || null, req.user.id]);

    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Add note ─────────────────────────────────────────────────────────────────
async function addNote(req, res, next) {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note is required.' });
    await db.query(`
      INSERT INTO service_feedback_activities (feedback_id, activity_type, note, created_by)
      VALUES ($1,'note',$2,$3)
    `, [req.params.id, note.trim(), req.user.id]);
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Export ───────────────────────────────────────────────────────────────────
async function exportFeedback(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT ref, submitter_type AS "Stakeholder Type", company_name AS "Company",
             CASE WHEN is_anonymous THEN 'Anonymous' ELSE submitter_name END AS "Name",
             submitter_email AS "Email", submitter_phone AS "Phone",
             category AS "Category", priority AS "Priority", subject AS "Subject",
             description AS "Description", date_occurred AS "Date of Incident",
             status AS "Status", assigned_to_name AS "Assigned To",
             resolution_notes AS "Resolution", resolved_date AS "Resolved Date",
             created_at AS "Submitted At"
      FROM service_feedback ORDER BY created_at DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Feedback');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Service-Feedback.xlsx"');
    return res.send(buf);
  } catch (err) { next(err); }
}

module.exports = { submitFeedback, getDashboard, listFeedback, getFeedback, changeStatus, addNote, exportFeedback };
