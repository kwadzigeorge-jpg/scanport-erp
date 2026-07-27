const db = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ── Gangs ─────────────────────────────────────────────────────────────────────
async function listGangs(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT g.id, g.name, g.code, g.color, g.is_active,
             COUNT(m.id) FILTER (WHERE m.is_active) AS member_count
      FROM scan_gangs g
      LEFT JOIN scan_gang_members m ON m.gang_id = g.id
      GROUP BY g.id ORDER BY g.id
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function listMembers(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT id, gang_id, full_name, employee_id, position_no, role, is_active
      FROM scan_gang_members
      WHERE gang_id = $1
      ORDER BY position_no
    `, [req.params.gangId]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function addMember(req, res, next) {
  try {
    const { full_name, employee_id, position_no, role = 'marshal' } = req.body;
    const { gangId } = req.params;
    if (!full_name || !position_no) {
      return res.status(400).json({ error: 'full_name and position_no are required.' });
    }
    const { rows } = await db.query(`
      INSERT INTO scan_gang_members (gang_id, full_name, employee_id, position_no, role)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [gangId, full_name.trim(), employee_id?.trim() || null, position_no, role]);
    await logAudit(req, 'marshal:member_added', 'scan_gang_members', rows[0].id, { gangId, full_name });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Position number already taken in this gang.' });
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { full_name, employee_id, position_no, role, is_active } = req.body;
    const updates = []; const params = [];
    if (full_name    !== undefined) { params.push(full_name.trim());  updates.push(`full_name=$${params.length}`); }
    if (employee_id  !== undefined) { params.push(employee_id?.trim() || null); updates.push(`employee_id=$${params.length}`); }
    if (position_no  !== undefined) { params.push(position_no);  updates.push(`position_no=$${params.length}`); }
    if (role         !== undefined) { params.push(role);          updates.push(`role=$${params.length}`); }
    if (is_active    !== undefined) { params.push(is_active);     updates.push(`is_active=$${params.length}`); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(req.params.memberId);
    const { rowCount } = await db.query(
      `UPDATE scan_gang_members SET ${updates.join(',')} WHERE id=$${params.length}`, params
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found.' });
    res.json({ message: 'Updated.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Position number already taken.' });
    next(err);
  }
}

async function deleteMember(req, res, next) {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM scan_gang_members WHERE id=$1', [req.params.memberId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

// ── Deployments ───────────────────────────────────────────────────────────────
async function getDeploymentView(req, res, next) {
  try {
    const { date, shift } = req.query;
    if (!date || !shift) return res.status(400).json({ error: 'date and shift are required.' });

    // All deployments for this date+shift
    const { rows: deps } = await db.query(`
      SELECT d.id, d.area, d.shift, d.deployment_date, d.status, d.notes,
             d.opened_by, d.closed_by, d.closed_at,
             g.id AS gang_id, g.name AS gang_name, g.code AS gang_code, g.color AS gang_color
      FROM marshal_deployments d
      JOIN scan_gangs g ON g.id = d.gang_id
      WHERE d.deployment_date = $1 AND d.shift = $2
    `, [date, shift]);

    // For each deployment, get attendance with member details
    const result = { IMPORTS: null, EXPORTS: null, INTRUSIVE: null };
    for (const dep of deps) {
      const { rows: att } = await db.query(`
        SELECT a.id, a.status, a.marked_at, a.notes,
               m.id AS member_id, m.full_name, m.position_no, m.role, m.employee_id,
               EXISTS (
                 SELECT 1 FROM marshal_overtime ot
                 WHERE ot.member_id = m.id AND ot.to_deployment_id = $1
               ) AS is_overtime
        FROM marshal_attendance a
        JOIN scan_gang_members m ON m.id = a.member_id
        WHERE a.deployment_id = $1
        ORDER BY m.position_no
      `, [dep.id]);

      const present = att.filter(a => a.status === 'present').length;
      const late    = att.filter(a => a.status === 'late').length;
      result[dep.area] = {
        ...dep,
        attendance: att,
        summary: { total: att.length, present, late, absent: att.filter(a => a.status === 'absent').length, pending: att.filter(a => a.status === 'pending').length },
      };
    }

    res.json(result);
  } catch (err) { next(err); }
}

async function createDeployment(req, res, next) {
  try {
    const { deployment_date, shift, area, gang_id, notes } = req.body;
    if (!deployment_date || !shift || !area || !gang_id) {
      return res.status(400).json({ error: 'deployment_date, shift, area and gang_id are required.' });
    }

    // Insert deployment
    const { rows } = await db.query(`
      INSERT INTO marshal_deployments (deployment_date, shift, area, gang_id, opened_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [deployment_date, shift, area, gang_id, req.user.id, notes || null]);

    const dep = rows[0];

    // Auto-create attendance stubs for all active members of this gang
    const { rows: members } = await db.query(
      'SELECT id FROM scan_gang_members WHERE gang_id=$1 AND is_active=TRUE ORDER BY position_no',
      [gang_id]
    );

    if (members.length) {
      const vals = members.map((m, i) => `($1, $${i + 2})`).join(',');
      await db.query(
        `INSERT INTO marshal_attendance (deployment_id, member_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [dep.id, ...members.map(m => m.id)]
      );
    }

    await logAudit(req, 'marshal:deployment_created', 'marshal_deployments', dep.id,
      { date: deployment_date, shift, area, gang_id });
    res.status(201).json({ ...dep, members_enrolled: members.length });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A deployment already exists for this area/shift/date.' });
    next(err);
  }
}

async function closeDeployment(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(`
      UPDATE marshal_deployments
      SET status='closed', closed_by=$1, closed_at=NOW()
      WHERE id=$2 AND status='open'
    `, [req.user.id, id]);
    if (!rowCount) return res.status(404).json({ error: 'Deployment not found or already closed.' });
    await logAudit(req, 'marshal:deployment_closed', 'marshal_deployments', id, {});
    res.json({ message: 'Deployment closed.' });
  } catch (err) { next(err); }
}

async function deleteDeployment(req, res, next) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      "DELETE FROM marshal_deployments WHERE id=$1 AND status='open'", [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Deployment not found or already closed.' });
    res.json({ message: 'Deployment deleted.' });
  } catch (err) { next(err); }
}

// ── Attendance ─────────────────────────────────────────────────────────────────
// Cycles: pending → present → absent → pending  (or explicit status)
const CYCLE = { pending: 'present', present: 'absent', absent: 'late', late: 'pending' };

async function toggleAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const { status: explicit } = req.body;

    const { rows: [cur] } = await db.query(
      'SELECT a.status, d.status AS dep_status FROM marshal_attendance a JOIN marshal_deployments d ON d.id=a.deployment_id WHERE a.id=$1',
      [id]
    );
    if (!cur) return res.status(404).json({ error: 'Attendance record not found.' });
    if (cur.dep_status === 'closed') return res.status(400).json({ error: 'Deployment is closed.' });

    const next_status = explicit || CYCLE[cur.status] || 'present';

    const { rows } = await db.query(`
      UPDATE marshal_attendance
      SET status=$1, marked_at=NOW(), marked_by=$2
      WHERE id=$3
      RETURNING *
    `, [next_status, req.user.id, id]);

    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function updateAttendanceNote(req, res, next) {
  try {
    const { notes } = req.body;
    const { rows } = await db.query(
      'UPDATE marshal_attendance SET notes=$1 WHERE id=$2 RETURNING *',
      [notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// ── Overtime ──────────────────────────────────────────────────────────────────
async function recordOvertime(req, res, next) {
  try {
    const { member_id, from_deployment_id, to_deployment_id, reason } = req.body;
    if (!member_id || !from_deployment_id || !to_deployment_id) {
      return res.status(400).json({ error: 'member_id, from_deployment_id and to_deployment_id are required.' });
    }
    const { rows } = await db.query(`
      INSERT INTO marshal_overtime (member_id, from_deployment_id, to_deployment_id, reason, recorded_by)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (member_id, from_deployment_id, to_deployment_id) DO NOTHING
      RETURNING *
    `, [member_id, from_deployment_id, to_deployment_id, reason || null, req.user.id]);

    if (!rows.length) return res.status(409).json({ error: 'Overtime already recorded.' });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function removeOvertime(req, res, next) {
  try {
    await db.query('DELETE FROM marshal_overtime WHERE id=$1', [req.params.id]);
    res.json({ message: 'Removed.' });
  } catch (err) { next(err); }
}

async function getOvertimeReport(req, res, next) {
  try {
    const { date, shift } = req.query;

    // For the given date+shift, find which marshals are on overtime
    // (i.e., they were present in a PREVIOUS deployment AND have an overtime link to current)
    const { rows } = await db.query(`
      SELECT ot.id AS ot_id,
             m.full_name, m.position_no, m.role,
             sg.name AS gang_name, sg.color AS gang_color,
             fd.deployment_date AS from_date, fd.shift AS from_shift, fd.area AS from_area,
             td.deployment_date AS to_date,   td.shift AS to_shift,   td.area AS to_area,
             ot.reason, ot.created_at,
             -- count consecutive OT shifts for this member (rolling)
             (SELECT COUNT(*) FROM marshal_overtime ot2
              WHERE ot2.member_id = ot.member_id
                AND ot2.created_at >= NOW() - INTERVAL '7 days') AS consecutive_count
      FROM marshal_overtime ot
      JOIN scan_gang_members m  ON m.id = ot.member_id
      JOIN scan_gangs sg         ON sg.id = m.gang_id
      JOIN marshal_deployments fd ON fd.id = ot.from_deployment_id
      JOIN marshal_deployments td ON td.id = ot.to_deployment_id
      WHERE ($1::DATE IS NULL OR td.deployment_date = $1)
        AND ($2::VARCHAR IS NULL OR td.shift = $2)
      ORDER BY ot.created_at DESC
    `, [date || null, shift || null]);

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { rows: [totals] } = await db.query(`
      SELECT
        COUNT(DISTINCT d.id)                                            AS deployments_today,
        COUNT(a.id) FILTER (WHERE a.status='present')                  AS present_total,
        COUNT(a.id) FILTER (WHERE a.status='absent')                   AS absent_total,
        COUNT(a.id) FILTER (WHERE a.status='late')                     AS late_total,
        COUNT(a.id) FILTER (WHERE a.status='pending')                  AS pending_total,
        COUNT(DISTINCT ot.member_id)                                   AS on_overtime
      FROM marshal_deployments d
      LEFT JOIN marshal_attendance a  ON a.deployment_id = d.id
      LEFT JOIN marshal_overtime   ot ON ot.to_deployment_id = d.id
      WHERE d.deployment_date = $1
    `, [today]);

    const { rows: byArea } = await db.query(`
      SELECT d.area, d.shift,
             g.name AS gang_name, g.color AS gang_color,
             COUNT(a.id)                                       AS total,
             COUNT(a.id) FILTER (WHERE a.status='present')    AS present,
             COUNT(a.id) FILTER (WHERE a.status='absent')     AS absent,
             COUNT(a.id) FILTER (WHERE a.status='late')       AS late
      FROM marshal_deployments d
      JOIN scan_gangs g ON g.id = d.gang_id
      LEFT JOIN marshal_attendance a ON a.deployment_id = d.id
      WHERE d.deployment_date = $1
      GROUP BY d.area, d.shift, g.name, g.color
      ORDER BY d.shift, d.area
    `, [today]);

    // Marshals with 2+ overtime shifts in last 7 days
    const { rows: highOT } = await db.query(`
      SELECT m.full_name, m.position_no, sg.name AS gang_name, sg.color AS gang_color,
             COUNT(*) AS ot_shifts
      FROM marshal_overtime ot
      JOIN scan_gang_members m ON m.id = ot.member_id
      JOIN scan_gangs sg ON sg.id = m.gang_id
      WHERE ot.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY m.id, m.full_name, m.position_no, sg.name, sg.color
      HAVING COUNT(*) >= 2
      ORDER BY ot_shifts DESC
      LIMIT 10
    `);

    res.json({ ...totals, by_area: byArea, high_overtime: highOT });
  } catch (err) { next(err); }
}

module.exports = {
  listGangs, listMembers, addMember, updateMember, deleteMember,
  getDeploymentView, createDeployment, closeDeployment, deleteDeployment,
  toggleAttendance, updateAttendanceNote,
  recordOvertime, removeOvertime, getOvertimeReport,
  getDashboard,
};
