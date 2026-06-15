const db = require('../config/database');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `REQ-${ts}-${rand}`;
}

function computeAllocationScore(gang, jobsToday, hoursSinceLastJob) {
  const headmanAvail = parseInt(gang.headman_available) > 0;
  const dockersAvail = Math.min(parseInt(gang.dockers_available) || 0, 4);
  // Availability (0–40): head man must be present; each available docker adds points
  const availability = !headmanAvail ? 0 : Math.round(10 + dockersAvail * 7.5);
  const workload = Math.max(0, 25 - jobsToday * 5);
  const performance = (parseFloat(gang.performance_score) / 100) * 25;
  const idle = Math.min((hoursSinceLastJob || 0) * 2.5, 10);
  return Math.round((availability + workload + performance + idle) * 10) / 10;
}

function computeJobScore({ actualMin, expectedMin, delayCount, agentRating, arrivedOnTime }) {
  const ratio = expectedMin > 0 ? actualMin / expectedMin : 1;
  const durationScore = ratio <= 1 ? 30 : Math.max(0, 30 - (ratio - 1) * 30);
  const delayScore = Math.max(0, 25 - delayCount * 5);
  const arrivalScore = arrivedOnTime ? 20 : 0;
  const ratingScore = agentRating ? (agentRating / 5) * 25 : 12.5;
  return {
    durationScore: Math.round(durationScore * 10) / 10,
    delayScore:    Math.round(delayScore    * 10) / 10,
    arrivalScore,
    ratingScore:   Math.round(ratingScore   * 10) / 10,
    total:         Math.round((durationScore + delayScore + arrivalScore + ratingScore) * 10) / 10,
  };
}

async function logAudit(req, action, entity, entityId, details) {
  try {
    await db.query(
      `INSERT INTO audit_logs (username, role, action, entity, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.user?.username, req.user?.role, action, entity, entityId, details, req.ip]
    );
  } catch (_) { /* non-fatal */ }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const [gangStats, requestStats, activeJobs, pendingQueue, topGangs, recentNotifs] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'available')  AS available,
          COUNT(*) FILTER (WHERE status = 'busy')       AS busy,
          COUNT(*) FILTER (WHERE status = 'on_break')   AS on_break,
          COUNT(*) FILTER (WHERE status = 'off_duty')   AS off_duty,
          COUNT(*)                                       AS total
        FROM gangs
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
          COUNT(*) FILTER (WHERE status = 'allocated') AS allocated,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today
        FROM gang_requests
      `),
      db.query(`
        SELECT a.*, g.gang_code, r.request_ref, r.bay_number, r.container_number,
               r.priority, r.agent_name,
               EXTRACT(EPOCH FROM (NOW() - a.allocated_at))/60 AS elapsed_minutes,
               CASE WHEN a.expected_start IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (NOW() - (a.expected_start + (a.expected_duration_minutes||' minutes')::INTERVAL)))/60
                 ELSE NULL
               END AS overdue_minutes
        FROM gang_allocations a
        JOIN gangs g ON g.id = a.gang_id
        JOIN gang_requests r ON r.id = a.request_id
        WHERE a.status IN ('allocated','gang_dispatched','in_progress')
        ORDER BY r.priority DESC, a.allocated_at ASC
      `),
      db.query(`
        SELECT r.*, u.full_name AS received_by_name
        FROM gang_requests r
        LEFT JOIN users u ON u.id = r.received_by
        WHERE r.status = 'pending'
        ORDER BY r.priority DESC, r.created_at ASC
        LIMIT 10
      `),
      db.query(`
        SELECT gang_code, status, performance_score, total_jobs_completed
        FROM gangs ORDER BY performance_score DESC LIMIT 5
      `),
      db.query(`
        SELECT * FROM gang_notifications
        WHERE is_read = FALSE ORDER BY created_at DESC LIMIT 20
      `),
    ]);

    return res.json({
      gangs:         gangStats.rows[0],
      requests:      requestStats.rows[0],
      active_jobs:   activeJobs.rows,
      pending_queue: pendingQueue.rows,
      top_gangs:     topGangs.rows,
      notifications: recentNotifs.rows,
    });
  } catch (err) { next(err); }
}

// ─── Gangs ────────────────────────────────────────────────────────────────────
async function listGangs(req, res, next) {
  try {
    const { status } = req.query;
    const params = [];
    const where = status ? `WHERE g.status=$1` : '';
    if (status) params.push(status);

    const { rows } = await db.query(`
      SELECT g.*,
        COUNT(m.id) FILTER (WHERE m.role = 'head_man') AS headman_count,
        COUNT(m.id) FILTER (WHERE m.role = 'docker')   AS docker_count,
        COUNT(m.id)                                     AS total_members,
        COUNT(m.id) FILTER (WHERE m.status = 'available' AND m.role = 'head_man') AS headman_available,
        COUNT(m.id) FILTER (WHERE m.status = 'available' AND m.role = 'docker')   AS dockers_available,
        COUNT(m.id) FILTER (WHERE m.status = 'available') AS available_count,
        COALESCE(json_agg(
          json_build_object(
            'id', m.id, 'full_name', m.full_name, 'role', m.role,
            'employee_id', m.employee_id, 'phone', m.phone, 'status', m.status
          ) ORDER BY CASE m.role WHEN 'head_man' THEN 1 ELSE 2 END, m.full_name
        ) FILTER (WHERE m.id IS NOT NULL), '[]') AS members,
        (SELECT COUNT(*) FROM gang_allocations
         WHERE gang_id = g.id AND DATE(allocated_at) = CURRENT_DATE) AS jobs_today,
        (SELECT MAX(work_completed_at) FROM gang_allocations
         WHERE gang_id = g.id AND status = 'completed') AS last_job_completed
      FROM gangs g
      LEFT JOIN gang_members m ON m.gang_id = g.id AND m.is_active = TRUE
      ${where ? where.replace('g.status', 'g.status') : ''}
      GROUP BY g.id
      ORDER BY g.performance_score DESC, g.gang_code
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getGang(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT g.*, u.full_name AS created_by_name FROM gangs g LEFT JOIN users u ON u.id = g.created_by WHERE g.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gang not found.' });
    const { rows: members } = await db.query(
      `SELECT * FROM gang_members WHERE gang_id=$1 ORDER BY role, full_name`, [req.params.id]
    );
    return res.json({ ...rows[0], members });
  } catch (err) { next(err); }
}

async function createGang(req, res, next) {
  try {
    const { gang_code, specialization, notes } = req.body;
    if (!gang_code) return res.status(400).json({ error: 'gang_code is required.' });
    const { rows } = await db.query(
      `INSERT INTO gangs (gang_code, specialization, notes, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [gang_code.toUpperCase(), specialization||null, notes||null, req.user.id]
    );
    await logAudit(req, 'gang:created', 'gangs', rows[0].id, { gang_code });
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Gang code already exists.' });
    next(err);
  }
}

async function updateGang(req, res, next) {
  try {
    const { id } = req.params;
    const { gang_code, specialization, notes, status } = req.body;
    const { rows } = await db.query(
      `UPDATE gangs SET
         gang_code=$1, specialization=$2, notes=$3, status=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [gang_code, specialization||null, notes||null, status, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gang not found.' });
    await logAudit(req, 'gang:updated', 'gangs', id, req.body);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function setGangStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['available','busy','on_break','off_duty'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const { rows } = await db.query(
      `UPDATE gangs SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`, [status, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gang not found.' });
    await logAudit(req, 'gang:status_changed', 'gangs', id, { status });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ── Members ──────────────────────────────────────────────────────────────────
async function listMembers(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM gang_members WHERE gang_id=$1 ORDER BY role, full_name`, [req.params.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function addMember(req, res, next) {
  try {
    const { id: gang_id } = req.params;
    const { role, full_name, employee_id, phone, joined_date } = req.body;
    if (!role || !full_name || !employee_id) return res.status(400).json({ error: 'role, full_name, employee_id required.' });

    const validRoles = ['head_man', 'docker'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'role must be head_man or docker.' });

    const { rows: existing } = await db.query(
      `SELECT COUNT(*) FROM gang_members WHERE gang_id=$1 AND role='docker' AND is_active=TRUE`, [gang_id]
    );
    if (role === 'docker' && parseInt(existing[0].count) >= 4) {
      return res.status(400).json({ error: 'A gang can have at most 4 dockers.' });
    }
    const { rows: headman } = await db.query(
      `SELECT COUNT(*) FROM gang_members WHERE gang_id=$1 AND role='head_man' AND is_active=TRUE`, [gang_id]
    );
    if (role === 'head_man' && parseInt(headman[0].count) >= 1) {
      return res.status(400).json({ error: 'A gang can have only 1 head man.' });
    }

    const { rows } = await db.query(
      `INSERT INTO gang_members (gang_id, role, full_name, employee_id, phone, joined_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [gang_id, role, full_name, employee_id, phone||null, joined_date||null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Employee ID already exists.' });
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { memberId } = req.params;
    const { full_name, phone, is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE gang_members SET full_name=$1, phone=$2, is_active=$3 WHERE id=$4 RETURNING *`,
      [full_name, phone||null, is_active !== false, memberId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found.' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function removeMember(req, res, next) {
  try {
    const { rows } = await db.query(
      `UPDATE gang_members SET is_active=FALSE WHERE id=$1 AND gang_id=$2 RETURNING *`,
      [req.params.memberId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found.' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

async function setMemberStatus(req, res, next) {
  try {
    const { id: gangId, memberId } = req.params;
    const { status } = req.body;
    const valid = ['available', 'on_break', 'off_duty', 'sick', 'on_leave'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const { rows } = await db.query(
      `UPDATE gang_members SET status=$1 WHERE id=$2 AND gang_id=$3 AND is_active=TRUE RETURNING *`,
      [status, memberId, gangId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found.' });
    await logAudit(req, 'gang:member_status_changed', 'gang_members', memberId, { status, gang_id: gangId });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Agent Requests ───────────────────────────────────────────────────────────
async function listRequests(req, res, next) {
  try {
    const { status, priority, from, to, search } = req.query;
    const conditions = []; const params = [];
    if (status)   { params.push(status);              conditions.push(`r.status=$${params.length}`); }
    if (priority) { params.push(priority);            conditions.push(`r.priority=$${params.length}`); }
    if (from)     { params.push(from);                conditions.push(`DATE(r.created_at)>=$${params.length}`); }
    if (to)       { params.push(to);                  conditions.push(`DATE(r.created_at)<=$${params.length}`); }
    if (search)   { params.push(`%${search}%`);       conditions.push(`(r.container_number ILIKE $${params.length} OR r.agent_name ILIKE $${params.length} OR r.bay_number ILIKE $${params.length})`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT r.*, u.full_name AS received_by_name,
        a.id AS allocation_id, a.gang_id, g.gang_code,
        a.status AS allocation_status, a.allocated_at
      FROM gang_requests r
      LEFT JOIN users u ON u.id = r.received_by
      LEFT JOIN gang_allocations a ON a.request_id = r.id AND a.status != 'cancelled'
      LEFT JOIN gangs g ON g.id = a.gang_id
      ${where}
      ORDER BY r.priority DESC, r.created_at DESC
      LIMIT 200
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createRequest(req, res, next) {
  try {
    const { agent_name, agent_phone, agency, bay_number, container_number, container_number_2, cargo_type, priority, notes } = req.body;
    if (!agent_name || !bay_number || !container_number) {
      return res.status(400).json({ error: 'agent_name, bay_number, container_number are required.' });
    }
    const cnumRegex = /^[A-Z]{4}\d{7}$/;
    const cnum = container_number.toUpperCase().replace(/\s/g,'');
    if (!cnumRegex.test(cnum)) {
      return res.status(400).json({ error: 'Invalid container number format. Expected: 4 letters + 7 digits (e.g. MSCU1234567).' });
    }

    let cnum2 = null;
    if (container_number_2 && container_number_2.trim()) {
      cnum2 = container_number_2.toUpperCase().replace(/\s/g,'');
      if (!cnumRegex.test(cnum2)) {
        return res.status(400).json({ error: 'Invalid second container number format. Expected: 4 letters + 7 digits.' });
      }
      if (cnum2 === cnum) {
        return res.status(400).json({ error: 'Second container number must differ from the first.' });
      }
      // Check duplicate on second container
      const { rows: dup2 } = await db.query(
        `SELECT id FROM gang_requests WHERE (container_number=$1 OR container_number_2=$1) AND status IN ('pending','allocated','in_progress')`,
        [cnum2]
      );
      if (dup2.length) return res.status(409).json({ error: 'An active request for the second container already exists.' });
    }

    // Check for duplicate active request on first container
    const { rows: dup } = await db.query(
      `SELECT id FROM gang_requests WHERE (container_number=$1 OR container_number_2=$1) AND status IN ('pending','allocated','in_progress')`,
      [cnum]
    );
    if (dup.length) return res.status(409).json({ error: 'An active request for this container already exists.' });

    const ref = genRef();
    const isDual = !!cnum2;
    const { rows } = await db.query(`
      INSERT INTO gang_requests
        (request_ref, agent_name, agent_phone, agency, bay_number, container_number,
         container_number_2, is_dual_container, cargo_type, priority, notes, received_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [ref, agent_name, agent_phone||null, agency||null, bay_number, cnum,
        cnum2, isDual, cargo_type||null, priority||'normal', notes||null, req.user.id]);

    await logAudit(req, 'gang:request_created', 'gang_requests', rows[0].id, { ref, container_number: cnum, container_number_2: cnum2 });
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function cancelRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `UPDATE gang_requests SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING *`, [id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Request not found or not in pending status.' });
    await logAudit(req, 'gang:request_cancelled', 'gang_requests', id, {});
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Allocation Engine ────────────────────────────────────────────────────────
async function recommendGangs(req, res, next) {
  try {
    const { rows: gangs } = await db.query(`
      SELECT g.*,
        COUNT(m.id) FILTER (WHERE m.is_active AND m.status='available' AND m.role='head_man') AS headman_available,
        COUNT(m.id) FILTER (WHERE m.is_active AND m.status='available' AND m.role='docker')   AS dockers_available,
        COUNT(m.id) FILTER (WHERE m.is_active)                                                AS total_members,
        (SELECT COUNT(*) FROM gang_allocations
         WHERE gang_id=g.id AND DATE(allocated_at)=CURRENT_DATE
           AND status NOT IN ('cancelled')) AS jobs_today,
        (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(work_completed_at)))/3600
         FROM gang_allocations WHERE gang_id=g.id AND status='completed') AS hours_since_last_job
      FROM gangs g
      LEFT JOIN gang_members m ON m.gang_id = g.id
      WHERE g.status != 'busy'
      GROUP BY g.id
    `);

    const scored = gangs.map(g => {
      const score = computeAllocationScore(g, parseInt(g.jobs_today)||0, parseFloat(g.hours_since_last_job)||0);
      const headAvail = parseInt(g.headman_available) > 0;
      const dockAvail = parseInt(g.dockers_available) || 0;
      const total     = parseInt(g.total_members) || 0;
      const reasons = [];
      if (!headAvail) reasons.push('Head man unavailable');
      else reasons.push(`Head man available`);
      reasons.push(`${dockAvail}/4 dockers available`);
      reasons.push(`${g.jobs_today} job(s) today`);
      reasons.push(`Perf: ${g.performance_score}`);
      return { ...g, allocation_score: score, score_reasons: reasons };
    });

    scored.sort((a,b) => b.allocation_score - a.allocation_score);
    return res.json(scored);
  } catch (err) { next(err); }
}

// ─── Allocations ──────────────────────────────────────────────────────────────
async function createAllocation(req, res, next) {
  try {
    const {
      request_id, gang_id, is_override, override_reason,
      expected_start, expected_duration_minutes,
      engine_recommended_gang, engine_score,
    } = req.body;

    if (!request_id || !gang_id) return res.status(400).json({ error: 'request_id and gang_id are required.' });

    // Validate request is still pending
    const { rows: reqRows } = await db.query(
      `SELECT * FROM gang_requests WHERE id=$1`, [request_id]
    );
    if (!reqRows[0]) return res.status(404).json({ error: 'Request not found.' });
    if (reqRows[0].status !== 'pending') return res.status(400).json({ error: `Request is already ${reqRows[0].status}.` });

    // Validate gang
    const { rows: gangRows } = await db.query(`SELECT * FROM gangs WHERE id=$1`, [gang_id]);
    if (!gangRows[0]) return res.status(404).json({ error: 'Gang not found.' });

    const client = await db.pool ? db.pool.connect() : null;
    try {
      // Create allocation
      const { rows: [alloc] } = await db.query(`
        INSERT INTO gang_allocations
          (request_id, gang_id, allocated_by, is_override, override_reason,
           engine_recommended_gang, engine_score,
           expected_start, expected_duration_minutes, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'allocated') RETURNING *
      `, [request_id, gang_id, req.user.id, !!is_override, override_reason||null,
          engine_recommended_gang||null, engine_score||null,
          expected_start||null, expected_duration_minutes||60]);

      // Update request status
      await db.query(`UPDATE gang_requests SET status='allocated', updated_at=NOW() WHERE id=$1`, [request_id]);

      // Update gang status to busy
      await db.query(`UPDATE gangs SET status='busy', updated_at=NOW() WHERE id=$1`, [gang_id]);

      // Create notification
      await db.query(`
        INSERT INTO gang_notifications (type, message, allocation_id, gang_id)
        VALUES ('job_assigned', $1, $2, $3)
      `, [`Gang ${gangRows[0].gang_code} assigned to Bay ${reqRows[0].bay_number} — Container ${reqRows[0].container_number}`, alloc.id, gang_id]);

      await logAudit(req, 'gang:allocated', 'gang_allocations', alloc.id, {
        request_id, gang_id, gang_code: gangRows[0].gang_code, is_override,
      });
      return res.status(201).json(alloc);
    } finally {
      if (client) client.release();
    }
  } catch (err) { next(err); }
}

async function listAllocations(req, res, next) {
  try {
    const { status, gang_id, from, to } = req.query;
    const conditions = []; const params = [];
    if (status)  { params.push(status);  conditions.push(`a.status=$${params.length}`); }
    if (gang_id) { params.push(gang_id); conditions.push(`a.gang_id=$${params.length}`); }
    if (from)    { params.push(from);    conditions.push(`DATE(a.allocated_at)>=$${params.length}`); }
    if (to)      { params.push(to);      conditions.push(`DATE(a.allocated_at)<=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT a.*, g.gang_code, g.performance_score,
             r.request_ref, r.bay_number, r.container_number, r.priority,
             r.agent_name, r.agent_phone, r.agency, r.cargo_type,
             u.full_name AS allocated_by_name,
             EXTRACT(EPOCH FROM (COALESCE(a.work_completed_at, NOW()) - COALESCE(a.work_started_at, a.allocated_at)))/60 AS elapsed_minutes,
             (SELECT COUNT(*) FROM gang_delay_logs WHERE allocation_id=a.id) AS delay_count
      FROM gang_allocations a
      JOIN gangs g ON g.id = a.gang_id
      JOIN gang_requests r ON r.id = a.request_id
      JOIN users u ON u.id = a.allocated_by
      ${where}
      ORDER BY a.allocated_at DESC
      LIMIT 200
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function logTimestamp(req, res, next) {
  try {
    const { id } = req.params;
    const { event } = req.body; // 'arrived' | 'started' | 'completed'

    const colMap = {
      arrived:   { col: 'gang_arrived_at',  status: 'gang_dispatched' },
      started:   { col: 'work_started_at',  status: 'in_progress' },
    };

    if (!colMap[event]) return res.status(400).json({ error: 'event must be arrived or started.' });
    const { col, status } = colMap[event];

    const { rows } = await db.query(
      `UPDATE gang_allocations SET ${col}=NOW(), status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Allocation not found.' });

    // Update request status to in_progress when work starts
    if (event === 'started') {
      await db.query(`UPDATE gang_requests SET status='in_progress', updated_at=NOW() WHERE id=$1`, [rows[0].request_id]);
    }
    await logAudit(req, `gang:timestamp_${event}`, 'gang_allocations', id, { event });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function completeJob(req, res, next) {
  try {
    const { id } = req.params;
    const { supervisor_comments } = req.body;

    const { rows: [alloc] } = await db.query(`
      UPDATE gang_allocations
        SET work_completed_at=NOW(), status='completed',
            supervisor_comments=$1, updated_at=NOW()
      WHERE id=$2 AND status='in_progress'
      RETURNING *
    `, [supervisor_comments||null, id]);
    if (!alloc) return res.status(400).json({ error: 'Allocation not found or not in_progress.' });

    // Mark request completed
    await db.query(`UPDATE gang_requests SET status='completed', updated_at=NOW() WHERE id=$1`, [alloc.request_id]);

    // Set gang back to available
    await db.query(`UPDATE gangs SET status='available', total_jobs_completed=total_jobs_completed+1, updated_at=NOW() WHERE id=$1`, [alloc.gang_id]);

    // Compute and store performance score
    const delayRes = await db.query(`SELECT COUNT(*) FROM gang_delay_logs WHERE allocation_id=$1`, [id]);
    const delayCount = parseInt(delayRes.rows[0].count);
    const actualMin = alloc.work_completed_at && alloc.work_started_at
      ? Math.round((new Date(alloc.work_completed_at) - new Date(alloc.work_started_at)) / 60000)
      : null;
    const arrivedOnTime = alloc.gang_arrived_at && alloc.expected_start
      ? new Date(alloc.gang_arrived_at) <= new Date(new Date(alloc.expected_start).getTime() + 10*60000)
      : null;

    if (actualMin !== null) {
      const scores = computeJobScore({
        actualMin,
        expectedMin: alloc.expected_duration_minutes,
        delayCount,
        agentRating: alloc.agent_rating,
        arrivedOnTime,
      });

      await db.query(`
        INSERT INTO gang_performance_records
          (gang_id, allocation_id, period_date,
           actual_duration_minutes, expected_duration_minutes, delay_count, agent_rating,
           arrived_on_time, duration_score, delay_score, arrival_score, rating_score, total_score)
        VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [alloc.gang_id, id, actualMin, alloc.expected_duration_minutes, delayCount,
          alloc.agent_rating, arrivedOnTime,
          scores.durationScore, scores.delayScore, scores.arrivalScore, scores.ratingScore, scores.total]);

      // Update rolling performance score (avg of last 10 jobs)
      await db.query(`
        UPDATE gangs SET performance_score = (
          SELECT ROUND(AVG(total_score)::NUMERIC, 2)
          FROM (SELECT total_score FROM gang_performance_records WHERE gang_id=$1 ORDER BY computed_at DESC LIMIT 10) t
        ), updated_at=NOW() WHERE id=$1
      `, [alloc.gang_id]);
    }

    await logAudit(req, 'gang:job_completed', 'gang_allocations', id, { gang_id: alloc.gang_id });
    return res.json(alloc);
  } catch (err) { next(err); }
}

async function logDelay(req, res, next) {
  try {
    const { id } = req.params;
    const { delay_type, delay_minutes, description } = req.body;
    if (!delay_type || !description) return res.status(400).json({ error: 'delay_type and description required.' });
    const { rows } = await db.query(`
      INSERT INTO gang_delay_logs (allocation_id, delay_type, delay_minutes, description, reported_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [id, delay_type, delay_minutes||null, description, req.user.id]);
    await logAudit(req, 'gang:delay_logged', 'gang_delay_logs', rows[0].id, { allocation_id: id, delay_type });
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function submitFeedback(req, res, next) {
  try {
    const { id } = req.params;
    const { agent_rating, agent_feedback } = req.body;
    if (!agent_rating) return res.status(400).json({ error: 'agent_rating required.' });
    const { rows } = await db.query(
      `UPDATE gang_allocations SET agent_rating=$1, agent_feedback=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [agent_rating, agent_feedback||null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Allocation not found.' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function getDelays(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT d.*, u.full_name AS reported_by_name FROM gang_delay_logs d
       LEFT JOIN users u ON u.id = d.reported_by
       WHERE d.allocation_id=$1 ORDER BY d.reported_at`, [req.params.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Performance ──────────────────────────────────────────────────────────────
async function getPerformance(req, res, next) {
  try {
    const { from, to, gang_id } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
    const toDate   = to   || new Date().toISOString().slice(0,10);

    const params = [fromDate, toDate];
    const gangFilter = gang_id ? `AND pr.gang_id=$3` : '';
    if (gang_id) params.push(gang_id);

    const { rows: gangStats } = await db.query(`
      SELECT g.gang_code, g.status, g.performance_score, g.total_jobs_completed,
        COUNT(pr.id)                          AS jobs_in_period,
        ROUND(AVG(pr.actual_duration_minutes)::NUMERIC, 1) AS avg_duration_min,
        ROUND(AVG(pr.total_score)::NUMERIC, 2) AS avg_score,
        SUM(pr.delay_count)                   AS total_delays,
        ROUND(AVG(pr.agent_rating)::NUMERIC, 2) AS avg_rating,
        SUM(CASE WHEN pr.arrived_on_time THEN 1 ELSE 0 END) AS on_time_count
      FROM gangs g
      LEFT JOIN gang_performance_records pr
        ON pr.gang_id = g.id AND pr.period_date BETWEEN $1 AND $2 ${gangFilter}
      GROUP BY g.id, g.gang_code, g.status, g.performance_score, g.total_jobs_completed
      ORDER BY avg_score DESC NULLS LAST
    `, params);

    const { rows: dailyTrend } = await db.query(`
      SELECT period_date,
        COUNT(*) AS jobs,
        ROUND(AVG(total_score)::NUMERIC, 2) AS avg_score,
        ROUND(AVG(actual_duration_minutes)::NUMERIC, 1) AS avg_duration,
        SUM(delay_count) AS total_delays
      FROM gang_performance_records
      WHERE period_date BETWEEN $1 AND $2
      GROUP BY period_date ORDER BY period_date
    `, [fromDate, toDate]);

    const { rows: delayBreakdown } = await db.query(`
      SELECT delay_type, COUNT(*) AS count,
             ROUND(AVG(delay_minutes)::NUMERIC, 1) AS avg_minutes
      FROM gang_delay_logs d
      JOIN gang_allocations a ON a.id = d.allocation_id
      WHERE DATE(d.reported_at) BETWEEN $1 AND $2
      GROUP BY delay_type ORDER BY count DESC
    `, [fromDate, toDate]);

    const { rows: bayStats } = await db.query(`
      SELECT r.bay_number,
        COUNT(*) AS job_count,
        ROUND(AVG(pr.actual_duration_minutes)::NUMERIC, 1) AS avg_duration
      FROM gang_performance_records pr
      JOIN gang_allocations a ON a.id = pr.allocation_id
      JOIN gang_requests r ON r.id = a.request_id
      WHERE pr.period_date BETWEEN $1 AND $2
      GROUP BY r.bay_number ORDER BY job_count DESC
    `, [fromDate, toDate]);

    return res.json({ gang_stats: gangStats, daily_trend: dailyTrend, delay_breakdown: delayBreakdown, bay_stats: bayStats });
  } catch (err) { next(err); }
}

// ─── Audit ────────────────────────────────────────────────────────────────────
async function getAuditLog(req, res, next) {
  try {
    const { from, to, gang_id } = req.query;
    const fromDate = from || new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10);
    const toDate   = to   || new Date().toISOString().slice(0,10);

    const params = [fromDate, toDate];
    const gangFilter = gang_id ? `AND a.gang_id=$3` : '';
    if (gang_id) params.push(gang_id);

    const { rows } = await db.query(`
      SELECT a.*, g.gang_code, r.request_ref, r.bay_number, r.container_number,
             r.priority, r.agent_name,
             u.full_name AS allocated_by_name,
             (SELECT COUNT(*) FROM gang_delay_logs WHERE allocation_id=a.id) AS delay_count,
             (SELECT STRING_AGG(delay_type, ', ') FROM gang_delay_logs WHERE allocation_id=a.id) AS delay_types
      FROM gang_allocations a
      JOIN gangs g ON g.id = a.gang_id
      JOIN gang_requests r ON r.id = a.request_id
      JOIN users u ON u.id = a.allocated_by
      WHERE DATE(a.allocated_at) BETWEEN $1 AND $2 ${gangFilter}
      ORDER BY a.allocated_at DESC
      LIMIT 500
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function getNotifications(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT n.*, g.gang_code FROM gang_notifications n
       LEFT JOIN gangs g ON g.id = n.gang_id
       ORDER BY n.created_at DESC LIMIT 50`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function markNotificationRead(req, res, next) {
  try {
    await db.query(`UPDATE gang_notifications SET is_read=TRUE WHERE id=$1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// ─── Automated Alerts (called by scheduler) ──────────────────────────────────
async function runGangAlerts() {
  try {
    // Alert: job overdue (active job exceeded expected duration by >15min)
    const { rows: overdue } = await db.query(`
      SELECT a.id, a.gang_id, g.gang_code, r.bay_number, r.container_number
      FROM gang_allocations a
      JOIN gangs g ON g.id = a.gang_id
      JOIN gang_requests r ON r.id = a.request_id
      WHERE a.status = 'in_progress'
        AND a.expected_start IS NOT NULL
        AND NOW() > a.expected_start + ((a.expected_duration_minutes + 15) || ' minutes')::INTERVAL
        AND NOT EXISTS (
          SELECT 1 FROM gang_notifications
          WHERE allocation_id = a.id AND type = 'job_overdue'
            AND created_at > NOW() - INTERVAL '1 hour'
        )
    `);
    for (const r of overdue) {
      await db.query(`
        INSERT INTO gang_notifications (type, message, allocation_id, gang_id)
        VALUES ('job_overdue', $1, $2, $3)
      `, [`OVERDUE: Gang ${r.gang_code} — Bay ${r.bay_number} (${r.container_number})`, r.id, r.gang_id]);
    }

    // Alert: gang idle (available gang with no job for >2h)
    const { rows: idle } = await db.query(`
      SELECT g.id, g.gang_code
      FROM gangs g
      WHERE g.status = 'available'
        AND (
          SELECT MAX(work_completed_at) FROM gang_allocations WHERE gang_id = g.id
        ) < NOW() - INTERVAL '2 hours'
        AND NOT EXISTS (
          SELECT 1 FROM gang_notifications
          WHERE gang_id = g.id AND type = 'idle_gang'
            AND created_at > NOW() - INTERVAL '2 hours'
        )
    `);
    for (const g of idle) {
      await db.query(`
        INSERT INTO gang_notifications (type, message, gang_id)
        VALUES ('idle_gang', $1, $2)
      `, [`Gang ${g.gang_code} has been idle for over 2 hours`, g.id]);
    }

    // Alert: pending request waiting >30min
    const { rows: longPending } = await db.query(`
      SELECT r.id, r.request_ref, r.bay_number, r.container_number, r.priority
      FROM gang_requests r
      WHERE r.status = 'pending'
        AND r.created_at < NOW() - INTERVAL '30 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM gang_notifications n
          JOIN gang_allocations a ON a.id = n.allocation_id
          WHERE a.request_id = r.id AND n.type = 'pending_request'
            AND n.created_at > NOW() - INTERVAL '30 minutes'
        )
    `);
    for (const r of longPending) {
      await db.query(`
        INSERT INTO gang_notifications (type, message)
        VALUES ('pending_request', $1)
      `, [`UNALLOCATED: ${r.priority.toUpperCase()} request ${r.request_ref} — Bay ${r.bay_number} pending >30min`]);
    }
  } catch (_) { /* non-fatal scheduler */ }
}

// ─── Shift Deployment Targets ─────────────────────────────────────────────────
async function getShiftTargets(req, res, next) {
  try {
    const { rows } = await db.query('SELECT * FROM gang_shift_targets ORDER BY day_of_week');
    res.json(rows);
  } catch (err) { next(err); }
}

async function updateShiftTarget(req, res, next) {
  try {
    const { dayOfWeek } = req.params;
    const { morning, night } = req.body;
    if (morning == null || night == null) return res.status(400).json({ error: 'morning and night are required.' });
    const { rows } = await db.query(
      `UPDATE gang_shift_targets SET morning=$1, night=$2, updated_at=NOW()
       WHERE day_of_week=$3 RETURNING *`,
      [morning, night, dayOfWeek]
    );
    if (!rows.length) return res.status(404).json({ error: 'Day not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard,
  listGangs, getGang, createGang, updateGang, setGangStatus,
  listMembers, addMember, updateMember, removeMember, setMemberStatus,
  listRequests, createRequest, cancelRequest,
  recommendGangs, createAllocation, listAllocations,
  logTimestamp, completeJob, logDelay, getDelays, submitFeedback,
  getPerformance,
  getAuditLog,
  getNotifications, markNotificationRead,
  getShiftTargets, updateShiftTarget,
  runGangAlerts,
};
