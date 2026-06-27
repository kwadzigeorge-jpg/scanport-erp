const db   = require('../config/database');
const XLSX = require('xlsx');

// ─── Public: submit report (no auth, no IP logged) ───────────────────────────
async function submitReport(req, res, next) {
  try {
    const {
      incident_type, incident_date, bay_number, amount_mentioned,
      description, staff_description,
      was_directly_affected, reporter_contact, company_name,
    } = req.body;

    if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
    if (!incident_type)       return res.status(400).json({ error: 'Incident type is required.' });

    const { rows } = await db.query(`
      INSERT INTO integrity_reports
        (incident_type, incident_date, bay_number, amount_mentioned,
         description, staff_description,
         was_directly_affected, reporter_contact, company_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, ref, status, created_at
    `, [
      incident_type,
      incident_date || null,
      bay_number?.trim() || null,
      amount_mentioned?.trim() || null,
      description.trim(),
      staff_description?.trim() || null,
      was_directly_affected || false,
      reporter_contact?.trim() || null,
      company_name?.trim() || null,
    ]);

    return res.status(201).json({ ref: rows[0].ref, id: rows[0].id });
  } catch (err) { next(err); }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const { rows: kpi } = await db.query(`
      SELECT
        COUNT(*)::int                                                      AS total,
        COUNT(*) FILTER (WHERE status='new')::int                          AS new_count,
        COUNT(*) FILTER (WHERE status='under_investigation')::int          AS investigating,
        COUNT(*) FILTER (WHERE status='substantiated')::int               AS substantiated,
        COUNT(*) FILTER (WHERE status='unsubstantiated')::int             AS unsubstantiated,
        COUNT(*) FILTER (WHERE status='closed')::int                      AS closed,
        COUNT(*) FILTER (WHERE DATE(created_at)=CURRENT_DATE)::int        AS today,
        COUNT(*) FILTER (WHERE was_directly_affected=TRUE)::int           AS directly_affected,
        COUNT(*) FILTER (WHERE reporter_contact IS NOT NULL)::int         AS with_contact
      FROM integrity_reports
    `);

    const { rows: byType } = await db.query(`
      SELECT incident_type, COUNT(*)::int AS count
      FROM integrity_reports GROUP BY incident_type ORDER BY count DESC
    `);

    const { rows: byBay } = await db.query(`
      SELECT bay_number, COUNT(*)::int AS count
      FROM integrity_reports
      WHERE bay_number IS NOT NULL
      GROUP BY bay_number ORDER BY count DESC LIMIT 10
    `);

    const { rows: trend } = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS count
      FROM integrity_reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day
    `);

    const { rows: recent } = await db.query(`
      SELECT id, ref, incident_type, incident_date, bay_number,
             was_directly_affected, status, created_at
      FROM integrity_reports
      ORDER BY created_at DESC LIMIT 10
    `);

    return res.json({ kpi: kpi[0], byType, byBay, trend, recent });
  } catch (err) { next(err); }
}

// ─── List ─────────────────────────────────────────────────────────────────────
async function listReports(req, res, next) {
  try {
    const { status, incident_type, from, to, search, page = 1, limit = 25 } = req.query;
    const l = Math.min(100, parseInt(limit));
    const offset = (Math.max(1, parseInt(page)) - 1) * l;
    const conditions = []; const params = [];

    if (status)        { params.push(status);        conditions.push(`status=$${params.length}`); }
    if (incident_type) { params.push(incident_type); conditions.push(`incident_type=$${params.length}`); }
    if (from)          { params.push(from);           conditions.push(`DATE(created_at)>=$${params.length}`); }
    if (to)            { params.push(to);             conditions.push(`DATE(created_at)<=$${params.length}`); }
    if (search)        { params.push(`%${search}%`);  conditions.push(`(ref ILIKE $${params.length} OR bay_number ILIKE $${params.length} OR description ILIKE $${params.length})`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT id, ref, incident_type, incident_date, bay_number, amount_mentioned,
             was_directly_affected, company_name, status, assigned_to, created_at
      FROM integrity_reports ${where}
      ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'under_investigation' THEN 1 ELSE 2 END, created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM integrity_reports ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: parseInt(page), limit: l, rows });
  } catch (err) { next(err); }
}

// ─── Get single ───────────────────────────────────────────────────────────────
async function getReport(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT r.*, u.full_name AS reviewed_by_name
       FROM integrity_reports r
       LEFT JOIN users u ON u.id = r.reviewed_by
       WHERE r.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });

    const { rows: activities } = await db.query(`
      SELECT a.*, u.full_name AS created_by_name
      FROM integrity_report_activities a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.report_id = $1 ORDER BY a.created_at ASC
    `, [req.params.id]);

    return res.json({ ...rows[0], activities });
  } catch (err) { next(err); }
}

// ─── Change status ────────────────────────────────────────────────────────────
async function changeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note, investigation_notes, assigned_to } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });

    const { rows: existing } = await db.query('SELECT * FROM integrity_reports WHERE id=$1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found.' });
    const old = existing[0];

    const sets = [`status=$1`, `reviewed_by=$2`, `updated_at=NOW()`];
    const params = [status, req.user.id];

    if (assigned_to !== undefined) {
      params.push(assigned_to || null); sets.push(`assigned_to=$${params.length}`);
    }
    if (investigation_notes !== undefined) {
      params.push(investigation_notes || null); sets.push(`investigation_notes=$${params.length}`);
    }
    if (status === 'closed' || status === 'substantiated' || status === 'unsubstantiated') {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`closed_date=$${params.length}`);
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE integrity_reports SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params
    );

    await db.query(`
      INSERT INTO integrity_report_activities
        (report_id, activity_type, old_status, new_status, note, created_by)
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
      INSERT INTO integrity_report_activities (report_id, activity_type, note, created_by)
      VALUES ($1,'note',$2,$3)
    `, [req.params.id, note.trim(), req.user.id]);
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Export ───────────────────────────────────────────────────────────────────
async function exportReports(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT ref AS "Ref", incident_type AS "Incident Type",
             incident_date AS "Date of Incident", bay_number AS "Bay",
             amount_mentioned AS "Amount Mentioned",
             was_directly_affected AS "Directly Affected",
             company_name AS "Company", description AS "Description",
             staff_description AS "Staff Description",
             status AS "Status", assigned_to AS "Assigned To",
             investigation_notes AS "Investigation Notes",
             closed_date AS "Closed Date", created_at AS "Reported At"
      FROM integrity_reports ORDER BY created_at DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Integrity Reports');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Integrity-Reports-${new Date().toISOString().slice(0,10)}.xlsx"`);
    return res.send(buf);
  } catch (err) { next(err); }
}

module.exports = { submitReport, getDashboard, listReports, getReport, changeStatus, addNote, exportReports };
