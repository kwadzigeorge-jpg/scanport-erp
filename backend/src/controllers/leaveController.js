const db = require('../config/database');

// ─── Constants ────────────────────────────────────────────────────────────────
const GIFT_TYPES = ['Maternity Leave', 'Paternity Leave'];

// Entitlement by role: Spvr, M Spvr, Maintenance = 21 days; Staff = 18 days
function entitlementForRole(role) {
  return ['supervisor', 'm_supervisor', 'maintenance'].includes(role) ? 21 : 18;
}

const ROLE_LABELS = {
  supervisor:   'Supervisor (Spvr)',
  m_supervisor: "Marshal's Supervisor (M Spvr)",
  maintenance:  'Maintenance Officer',
  staff:        'Staff',
};

// ─── Seed data ────────────────────────────────────────────────────────────────
// Seed roster reflects June 2026 (updated from original onboarding roster)
const SEED_DEPTS = [
  {
    label: 'Scanning Teams',
    teams: {
      'Scanning Team 1': [
        { name: 'Dennis Gardiner', role: 'supervisor' },
        { name: 'Mertz Matthew', role: 'staff' },
        { name: 'Sitsope Cudjoe', role: 'staff' },
        { name: 'Dorcas Gaayuoni Nantamba', role: 'staff' },
        { name: 'Linda Debrah', role: 'staff' },
        { name: 'Jasper Frimpong', role: 'm_supervisor' },
      ],
      'Scanning Team 2': [
        { name: 'Janet Agyei-Gyane', role: 'supervisor' },
        { name: 'Joseph Dabuo', role: 'staff' },
        { name: 'Nana Yaw Mantey', role: 'staff' },
        { name: 'Wendy Lartey', role: 'staff' },
        { name: 'Stacey Naa Adjeley Adjei', role: 'staff' },   // moved from Intrusive Team B
        { name: 'Alex Danquah-Smith', role: 'm_supervisor' },
      ],
      'Scanning Team 3': [
        { name: 'Eugenia Abbeo', role: 'supervisor' },
        { name: 'Gifty Ampaabeng', role: 'staff' },
        { name: 'Frank Onomah Hayford', role: 'staff' },
        { name: 'Nathaniel Codjoe', role: 'staff' },           // moved from Intrusive Team A
        { name: 'Gifty Yelifari', role: 'staff' },
        { name: 'Paul Continua', role: 'm_supervisor' },
      ],
      'Scanning Team 4': [
        { name: 'Frederick Ankrah', role: 'supervisor' },       // promoted from staff
        { name: 'Abdul-Malik Osumanu', role: 'staff' },         // moved from Intrusive Team D
        { name: 'Bismack Acheampong', role: 'staff' },          // moved from Intrusive Team D
        { name: 'Joshua Okpoti', role: 'staff' },               // moved from Intrusive Team D
        { name: 'Sarah Adjabeng Mongson', role: 'staff' },
        { name: 'Kwabena Akuamoah', role: 'm_supervisor' },
      ],
      'Scanning Team 5': [
        { name: 'Pamela Lamptey Mills', role: 'supervisor' },
        { name: 'Kwabena Akosa', role: 'staff' },               // moved from Intrusive Team C
        { name: 'Florence Kapre', role: 'staff' },              // moved from Intrusive Team C
        { name: 'Vanessa Akumeh', role: 'staff' },
        { name: 'Gabriel Wononua Aviella', role: 'staff' },
        { name: 'Seth Ampem', role: 'm_supervisor' },
      ],
      'Scanning Team 6': [
        { name: 'Priscilla Quagraine', role: 'supervisor' },
        { name: 'Saajida Osman Kasanga', role: 'staff' },       // moved from Intrusive Team B
        { name: 'Mubarik Sahanun', role: 'staff' },
        { name: 'Ouedraogo Peter Anthony', role: 'staff' },     // moved from Intrusive Team A
        { name: 'Juliana Affum', role: 'staff' },               // moved from Intrusive Team B
        { name: 'Ampartey Boateng', role: 'm_supervisor' },
      ],
      'Scanning Team 7': [
        { name: 'Kwadwo Asah-Opoku', role: 'supervisor' },
        { name: 'Evelyn Ashitey', role: 'staff' },
        { name: 'Bright Nyadzro', role: 'staff' },              // moved from Intrusive Team A
        { name: 'Angela Dufie Agyemang', role: 'staff' },       // moved from Intrusive Team A
        { name: 'Maud Adubea Osei', role: 'staff' },
        { name: 'Ebenezer Mensah', role: 'm_supervisor' },
      ],
      'Scanning Team 8': [
        { name: 'Mary Abalo', role: 'supervisor' },             // promoted; moved from Team 6
        { name: 'David Dabuq', role: 'staff' },
        { name: 'Enoch Adjei Agyapong', role: 'staff' },
        { name: 'Roland Abeiku Egyir', role: 'staff' },
        { name: 'Dennis Amofah', role: 'staff' },
        { name: 'Raymond Adu Parkoh', role: 'm_supervisor' },
      ],
    },
  },
  {
    label: 'Post-Scan Teams',
    teams: {
      // Supervisors of Intrusive Teams A–D are labeled (M Spvr) in the roster
      // document and identified by red text. They carry 21-day entitlement.
      'Intrusive Team A': [
        { name: 'Michael Fiawoyife', role: 'staff' },
        { name: 'Francis Essel', role: 'staff' },
        { name: 'Issahaku Nafisah', role: 'staff' },
        { name: 'Elsie Ankrah', role: 'staff' },
        { name: 'Emmanuel Ackah', role: 'staff' },              // moved from Scanning Team 3
        { name: 'Edwina Aku Addo', role: 'staff' },             // moved from Scanning Team 4
        { name: 'Abdul-Rahman Imran', role: 'staff' },          // moved from Scanning Team 7
        { name: 'Don Annan', role: 'staff' },                   // moved from Scanning Team 7
        { name: 'Anthony Blay', role: 'm_supervisor' },
      ],
      'Intrusive Team B': [
        { name: 'Shelter Dogbatse', role: 'staff' },
        { name: 'Talent Abalo', role: 'staff' },
        { name: 'Briana Ayittah', role: 'staff' },              // moved from Scanning Team 6
        { name: 'Stephanie Ackah Blay', role: 'staff' },        // moved from Scanning Team 2
        { name: 'Emmanuel Kusark', role: 'staff' },
        { name: 'Andrew Nsowah', role: 'staff' },               // moved from Scanning Team 6
        { name: 'Wisdom Zikpi', role: 'm_supervisor' },
      ],
      'Intrusive Team C': [
        { name: 'Esi Bassaw', role: 'staff' },
        { name: 'Joseph Baiden', role: 'staff' },
        { name: 'Frederick Hunno-Osabutey', role: 'staff' },
        { name: 'Godfred Nyame', role: 'staff' },
        { name: 'Paul Essien', role: 'staff' },
        { name: 'Kwaku Amoako-Atta', role: 'staff' },
        { name: 'Justina S. Fosu', role: 'staff' },             // moved from Scanning Team 5
        { name: 'Francis Videy', role: 'm_supervisor' },
      ],
      'Intrusive Team D': [
        { name: 'Alhassan Faisal', role: 'staff' },
        { name: 'Grant Albert Asiakwa', role: 'staff' },
        { name: 'Daniel Odei Fianko', role: 'staff' },
        { name: 'Pius Duvor', role: 'staff' },                  // moved from Scanning Team 4
        { name: 'Lilian Osei', role: 'staff' },                 // moved from Scanning Team 4
        { name: 'Esther Dabier', role: 'staff' },
        { name: 'Kamaldeen Salifu', role: 'staff' },            // moved from Scanning Team 8
        { name: 'Lily Ofosua Acheampong', role: 'staff' },
        { name: 'Samuel Baah-Borquaye', role: 'm_supervisor' }, // new; replaced Prince Obiri
      ],
    },
  },
  {
    label: 'Support Units',
    teams: {
      'Maintenance': [
        { name: 'Kwesi Ofori-Boateng', role: 'maintenance' },
        { name: 'Isaac Kofi Ohene', role: 'maintenance' },
        { name: 'Emmanuel Adjei', role: 'maintenance' },
        { name: 'Carl Selassie Tsatsu', role: 'maintenance' },
      ],
      'HSSE': [
        { name: 'Kristopher Ohene Sam', role: 'staff' },
        { name: 'Bernard Adokoh', role: 'staff' },
        { name: 'Emmanuel Kissiedu', role: 'staff' },
        { name: 'Julia Ofori-Ameyaw', role: 'staff' },
        { name: 'Divine Senyemi', role: 'staff' },
        { name: 'Augustina Obeng', role: 'staff' },
        { name: 'George Sunday Namba', role: 'staff' },
        { name: 'Amanda Mensah', role: 'staff' },
        { name: 'Godwin Owusu', role: 'staff' },
      ],
    },
  },
];

const SEED_HOLIDAYS = [
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-01-07', name: 'Constitution Day' },
  { date: '2025-03-06', name: 'Independence Day' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Easter Monday' },
  { date: '2025-05-01', name: "Workers' Day" },
  { date: '2025-05-25', name: 'Africa Day' },
  { date: '2025-07-01', name: 'Republic Day' },
  { date: '2025-09-21', name: "Founder's Day" },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Boxing Day' },
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-07', name: 'Constitution Day' },
  { date: '2026-03-06', name: 'Independence Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-01', name: "Workers' Day" },
  { date: '2026-05-25', name: 'Africa Day' },
  { date: '2026-07-01', name: 'Republic Day' },
  { date: '2026-09-21', name: "Founder's Day" },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-26', name: 'Boxing Day' },
];

// ─── Schema setup ─────────────────────────────────────────────────────────────
async function ensureSchema() {
  const client = await db.getClient();
  try {
    // Create base tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS lms_departments (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lms_teams (
        id            SERIAL PRIMARY KEY,
        department_id INT REFERENCES lms_departments(id) ON DELETE CASCADE,
        name          VARCHAR(100) NOT NULL,
        UNIQUE(department_id, name)
      );
      CREATE TABLE IF NOT EXISTS lms_staff (
        id                 SERIAL PRIMARY KEY,
        team_id            INT REFERENCES lms_teams(id) ON DELETE SET NULL,
        name               VARCHAR(200) NOT NULL,
        role               VARCHAR(50)  NOT NULL DEFAULT 'staff',
        annual_entitlement INT NOT NULL DEFAULT 18,
        is_active          BOOLEAN DEFAULT TRUE,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lms_leave_requests (
        id               SERIAL PRIMARY KEY,
        staff_id         INT REFERENCES lms_staff(id) ON DELETE CASCADE,
        leave_type       VARCHAR(60)  NOT NULL,
        start_date       DATE NOT NULL,
        end_date         DATE NOT NULL,
        working_days     INT  NOT NULL,
        year             INT  NOT NULL,
        entitlement_year INT,
        is_gift_leave    BOOLEAN DEFAULT FALSE,
        status           VARCHAR(20) NOT NULL DEFAULT 'Pending',
        auto_decision    BOOLEAN DEFAULT FALSE,
        clash_with       TEXT,
        notes            TEXT,
        submitted_by     VARCHAR(200),
        approved_at      TIMESTAMPTZ,
        approved_by      VARCHAR(200),
        rejected_at      TIMESTAMPTZ,
        rejected_by      VARCHAR(200),
        rejection_reason TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS lms_public_holidays (
        id   SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL
      );
    `);

    // Safe migrations for columns added after v1
    await client.query(`
      ALTER TABLE lms_leave_requests ADD COLUMN IF NOT EXISTS entitlement_year INT;
      ALTER TABLE lms_leave_requests ADD COLUMN IF NOT EXISTS auto_decision BOOLEAN DEFAULT FALSE;
      ALTER TABLE lms_leave_requests ADD COLUMN IF NOT EXISTS clash_with TEXT;
    `);

    // Fix entitlements for existing staff by role (idempotent)
    await client.query(`
      UPDATE lms_staff SET annual_entitlement = CASE
        WHEN role IN ('supervisor', 'm_supervisor', 'maintenance') THEN 21
        ELSE 18
      END
    `);

    // Seed when tables are empty
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM lms_departments');
    if (parseInt(count) === 0) {
      for (const dept of SEED_DEPTS) {
        const { rows: [d] } = await client.query(
          'INSERT INTO lms_departments (name) VALUES ($1) RETURNING id', [dept.label]
        );
        for (const [teamName, members] of Object.entries(dept.teams)) {
          const { rows: [t] } = await client.query(
            'INSERT INTO lms_teams (department_id, name) VALUES ($1,$2) RETURNING id',
            [d.id, teamName]
          );
          for (const m of members) {
            await client.query(
              'INSERT INTO lms_staff (team_id, name, role, annual_entitlement) VALUES ($1,$2,$3,$4)',
              [t.id, m.name, m.role, entitlementForRole(m.role)]
            );
          }
        }
      }
    }

    const { rows: [{ count: hc }] } = await client.query('SELECT COUNT(*) FROM lms_public_holidays');
    if (parseInt(hc) === 0) {
      for (const h of SEED_HOLIDAYS) {
        await client.query(
          'INSERT INTO lms_public_holidays (date, name) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [h.date, h.name]
        );
      }
    }
  } finally {
    client.release();
  }
}

// ─── Overview ─────────────────────────────────────────────────────────────────
async function getOverview(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const year  = new Date().getFullYear();

    const { rows: onLeave } = await db.query(
      `SELECT lr.id, s.name, t.name AS team, lr.leave_type, lr.end_date
       FROM lms_leave_requests lr
       JOIN lms_staff s ON s.id = lr.staff_id
       LEFT JOIN lms_teams t ON t.id = s.team_id
       WHERE lr.status = 'Approved' AND lr.start_date <= $1 AND lr.end_date >= $1
       ORDER BY t.name, s.name`, [today]
    );

    const { rows: [{ cnt: pendingCount }] } = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM lms_leave_requests WHERE status='Pending'`
    );

    // Low balance: remaining ≤ 5 days for current year (including carry-over)
    const { rows: lowBalance } = await db.query(
      `SELECT s.id, s.name, t.name AS team, s.annual_entitlement, s.role,
              COALESCE(SUM(lr.working_days) FILTER (
                WHERE lr.status='Approved' AND (lr.entitlement_year=$1 OR (lr.entitlement_year IS NULL AND lr.year=$1))
                  AND NOT lr.is_gift_leave
              ), 0)::int AS used_current,
              COALESCE(SUM(lr.working_days) FILTER (
                WHERE lr.status='Approved' AND (lr.entitlement_year=$1-1 OR (lr.entitlement_year IS NULL AND lr.year=$1-1))
                  AND NOT lr.is_gift_leave
              ), 0)::int AS used_prev
       FROM lms_staff s
       LEFT JOIN lms_teams t ON t.id = s.team_id
       LEFT JOIN lms_leave_requests lr ON lr.staff_id = s.id
       WHERE s.is_active = TRUE
       GROUP BY s.id, s.name, t.name, s.annual_entitlement, s.role
       HAVING (s.annual_entitlement + GREATEST(0, s.annual_entitlement - COALESCE(SUM(lr.working_days) FILTER (
         WHERE lr.status='Approved' AND (lr.entitlement_year=$1-1 OR (lr.entitlement_year IS NULL AND lr.year=$1-1))
           AND NOT lr.is_gift_leave), 0))
         - COALESCE(SUM(lr.working_days) FILTER (
             WHERE lr.status='Approved' AND (lr.entitlement_year=$1 OR (lr.entitlement_year IS NULL AND lr.year=$1))
               AND NOT lr.is_gift_leave), 0)) <= 5
       ORDER BY (s.annual_entitlement - COALESCE(SUM(lr.working_days) FILTER (
         WHERE lr.status='Approved' AND NOT lr.is_gift_leave), 0))`, [year]
    );

    return res.json({ onLeave, pendingCount, lowBalance, today });
  } catch (err) { next(err); }
}

// ─── Leave Requests ───────────────────────────────────────────────────────────
async function getRequests(req, res, next) {
  try {
    const { status, team, year, entitlementYear, staffId, page = 1, limit = 200 } = req.query;
    const conds = [];
    const params = [];

    if (status)          { params.push(status);                  conds.push(`lr.status=$${params.length}`); }
    if (staffId)         { params.push(parseInt(staffId));        conds.push(`lr.staff_id=$${params.length}`); }
    if (team)            { params.push(team);                    conds.push(`t.name=$${params.length}`); }
    if (year)            { params.push(parseInt(year));           conds.push(`lr.year=$${params.length}`); }
    if (entitlementYear) { params.push(parseInt(entitlementYear));conds.push(`lr.entitlement_year=$${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT lr.*, s.name AS staff_name, s.role AS staff_role,
              t.name AS team_name, d.name AS dept_name
       FROM lms_leave_requests lr
       JOIN lms_staff s ON s.id = lr.staff_id
       LEFT JOIN lms_teams t ON t.id = s.team_id
       LEFT JOIN lms_departments d ON d.id = t.department_id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(*)::int AS total FROM lms_leave_requests lr
       JOIN lms_staff s ON s.id = lr.staff_id
       LEFT JOIN lms_teams t ON t.id = s.team_id
       ${where}`, params
    );

    return res.json({ requests: rows, total: cnt.total });
  } catch (err) { next(err); }
}

// ─── Submit + Auto-Decision ───────────────────────────────────────────────────
async function submitRequest(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { staffId, leaveType, startDate, endDate, workingDays, year, entitlementYear, notes } = req.body;
    if (!staffId || !leaveType || !startDate || !endDate || !workingDays || !year) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'staffId, leaveType, startDate, endDate, workingDays, year are required.' });
    }

    const entYear = entitlementYear ? parseInt(entitlementYear) : parseInt(year);

    const { rows: [staff] } = await client.query(
      `SELECT s.*, t.id AS team_id_val, t.name AS team_name
       FROM lms_staff s LEFT JOIN lms_teams t ON t.id = s.team_id WHERE s.id=$1`, [staffId]
    );
    if (!staff) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Staff member not found.' }); }

    const isGift = GIFT_TYPES.includes(leaveType);

    // ── Balance check (Annual Leave only) ──
    if (!isGift && leaveType === 'Annual Leave') {
      // carry-over from entYear-1
      const { rows: [prevUsed] } = await client.query(
        `SELECT COALESCE(SUM(working_days),0)::int AS used FROM lms_leave_requests
         WHERE staff_id=$1 AND status='Approved' AND NOT is_gift_leave
           AND (entitlement_year=$2 OR (entitlement_year IS NULL AND year=$2))`,
        [staffId, entYear - 1]
      );
      const carryOver = Math.max(0, staff.annual_entitlement - prevUsed.used);

      const { rows: [curUsed] } = await client.query(
        `SELECT COALESCE(SUM(working_days),0)::int AS used FROM lms_leave_requests
         WHERE staff_id=$1 AND status='Approved' AND NOT is_gift_leave
           AND (entitlement_year=$2 OR (entitlement_year IS NULL AND year=$2))`,
        [staffId, entYear]
      );
      const totalAvailable = staff.annual_entitlement + (entYear === parseInt(year) ? carryOver : 0);
      const remaining = totalAvailable - curUsed.used;

      if (workingDays > remaining) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Insufficient ${entYear} leave balance. ${remaining} day(s) available, request is for ${workingDays} day(s).`,
          insufficientBalance: true,
          remaining,
        });
      }
    }

    // ── Clash detection within same team ──
    let clashWith = null;
    if (staff.team_id_val) {
      const { rows: clashes } = await client.query(
        `SELECT s.name, lr.start_date, lr.end_date
         FROM lms_leave_requests lr
         JOIN lms_staff s ON s.id = lr.staff_id
         WHERE s.team_id = $1
           AND s.id != $2
           AND lr.status = 'Approved'
           AND lr.start_date <= $3
           AND lr.end_date   >= $4`,
        [staff.team_id_val, staffId, endDate, startDate]
      );
      if (clashes.length > 0) {
        clashWith = clashes.map(c =>
          `${c.name} (${new Date(c.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${new Date(c.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`
        ).join('; ');
      }
    }

    const { rows: [rec] } = await client.query(
      `INSERT INTO lms_leave_requests
         (staff_id, leave_type, start_date, end_date, working_days, year, entitlement_year,
          is_gift_leave, status, auto_decision, clash_with, notes, submitted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',FALSE,$9,$10,$11)
       RETURNING *`,
      [staffId, leaveType, startDate, endDate, workingDays, parseInt(year), entYear,
       isGift, clashWith || null, notes || null,
       req.user.fullName || req.user.username]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      ...rec,
      staff_name: staff.name,
      team_name: staff.team_name,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── Manual override (admin only) ────────────────────────────────────────────
async function approveRequest(req, res, next) {
  try {
    const { rows: [r] } = await db.query(
      `UPDATE lms_leave_requests
       SET status='Approved', auto_decision=FALSE, approved_at=NOW(), approved_by=$1,
           rejected_at=NULL, rejected_by=NULL, rejection_reason=NULL
       WHERE id=$2 RETURNING *`,
      [req.user.fullName || req.user.username, req.params.id]
    );
    if (!r) return res.status(404).json({ error: 'Request not found.' });
    return res.json(r);
  } catch (err) { next(err); }
}

async function rejectRequest(req, res, next) {
  try {
    const { reason } = req.body;
    const { rows: [r] } = await db.query(
      `UPDATE lms_leave_requests
       SET status='Rejected', auto_decision=FALSE, rejected_at=NOW(), rejected_by=$1,
           rejection_reason=$2, approved_at=NULL, approved_by=NULL
       WHERE id=$3 RETURNING *`,
      [req.user.fullName || req.user.username, reason || null, req.params.id]
    );
    if (!r) return res.status(404).json({ error: 'Request not found.' });
    return res.json(r);
  } catch (err) { next(err); }
}

async function deleteRequest(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM lms_leave_requests WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Request not found.' });
    return res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

// ─── Balances (with carry-over) ───────────────────────────────────────────────
async function getBalances(req, res, next) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { team, dept } = req.query;

    const conds = ['s.is_active = TRUE'];
    const params = [year];
    if (team) { params.push(team); conds.push(`t.name=$${params.length}`); }
    if (dept) { params.push(dept); conds.push(`d.name=$${params.length}`); }

    const { rows } = await db.query(
      `SELECT s.id, s.name, s.role, s.annual_entitlement,
              t.name AS team, d.name AS dept,
              -- days used from PREVIOUS year's allocation (drawn this year or last)
              COALESCE(SUM(lr.working_days) FILTER (
                WHERE lr.status='Approved' AND NOT lr.is_gift_leave
                  AND (lr.entitlement_year=$1-1 OR (lr.entitlement_year IS NULL AND lr.year=$1-1))
              ), 0)::int AS prev_year_used,
              -- days used from THIS year's allocation
              COALESCE(SUM(lr.working_days) FILTER (
                WHERE lr.status='Approved' AND NOT lr.is_gift_leave
                  AND (lr.entitlement_year=$1 OR (lr.entitlement_year IS NULL AND lr.year=$1))
              ), 0)::int AS current_year_used
       FROM lms_staff s
       LEFT JOIN lms_teams t ON t.id = s.team_id
       LEFT JOIN lms_departments d ON d.id = t.department_id
       LEFT JOIN lms_leave_requests lr ON lr.staff_id = s.id
       WHERE ${conds.join(' AND ')}
       GROUP BY s.id, s.name, s.role, s.annual_entitlement, t.name, d.name
       ORDER BY d.name, t.name, s.name`,
      params
    );

    const result = rows.map(s => {
      const carryOver    = Math.max(0, s.annual_entitlement - s.prev_year_used);
      const totalBudget  = s.annual_entitlement + carryOver;
      const used         = s.current_year_used;
      const remaining    = totalBudget - used;
      return { ...s, carry_over: carryOver, total_budget: totalBudget, used, remaining };
    });

    return res.json(result);
  } catch (err) { next(err); }
}

// ─── Departments & Teams ──────────────────────────────────────────────────────
async function getDepartments(req, res, next) {
  try {
    const { rows: depts } = await db.query(
      `SELECT d.id, d.name,
              COALESCE(json_agg(json_build_object(
                'id', t.id, 'name', t.name,
                'member_count', (SELECT COUNT(*) FROM lms_staff WHERE team_id=t.id AND is_active=TRUE)
              ) ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]') AS teams
       FROM lms_departments d
       LEFT JOIN lms_teams t ON t.department_id = d.id
       GROUP BY d.id ORDER BY d.name`
    );
    return res.json(depts);
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const { rows: [d] } = await db.query(
      'INSERT INTO lms_departments (name) VALUES ($1) RETURNING *', [name.trim()]
    );
    return res.status(201).json(d);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Department already exists.' });
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM lms_departments WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Department not found.' });
    return res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

async function addTeam(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Team name is required.' });
    const { rows: [t] } = await db.query(
      'INSERT INTO lms_teams (department_id, name) VALUES ($1,$2) RETURNING *',
      [req.params.deptId, name.trim()]
    );
    return res.status(201).json(t);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Team already exists in this department.' });
    next(err);
  }
}

async function deleteTeam(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM lms_teams WHERE id=$1', [req.params.teamId]);
    if (!rowCount) return res.status(404).json({ error: 'Team not found.' });
    return res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

// ─── Roster replace (monthly update) ─────────────────────────────────────────
async function replaceTeamRoster(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { teamId } = req.params;
    const { members } = req.body; // [{ name, role }]

    if (!Array.isArray(members) || members.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'members array is required.' });
    }

    // Deactivate all current members (preserve leave records)
    await client.query('UPDATE lms_staff SET is_active=FALSE WHERE team_id=$1', [teamId]);

    // Insert new members
    const added = [];
    for (const m of members) {
      if (!m.name?.trim()) continue;
      const role = m.role || 'staff';
      const { rows: [s] } = await client.query(
        'INSERT INTO lms_staff (team_id, name, role, annual_entitlement) VALUES ($1,$2,$3,$4) RETURNING *',
        [teamId, m.name.trim(), role, entitlementForRole(role)]
      );
      added.push(s);
    }

    await client.query('COMMIT');
    return res.json({ replaced: added.length, members: added });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

// ─── Staff ────────────────────────────────────────────────────────────────────
async function getStaff(req, res, next) {
  try {
    const { teamId, search } = req.query;
    const conds = ['s.is_active = TRUE'];
    const params = [];

    if (teamId) { params.push(parseInt(teamId)); conds.push(`s.team_id=$${params.length}`); }
    if (search) { params.push(`%${search}%`);    conds.push(`s.name ILIKE $${params.length}`); }

    const { rows } = await db.query(
      `SELECT s.*, t.name AS team_name, d.name AS dept_name
       FROM lms_staff s
       LEFT JOIN lms_teams t ON t.id = s.team_id
       LEFT JOIN lms_departments d ON d.id = t.department_id
       WHERE ${conds.join(' AND ')}
       ORDER BY d.name, t.name, s.name`,
      params
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function addStaff(req, res, next) {
  try {
    const { teamId, name, role, annualEntitlement } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const r = role || 'staff';
    const ent = annualEntitlement != null ? parseInt(annualEntitlement) : entitlementForRole(r);
    const { rows: [s] } = await db.query(
      `INSERT INTO lms_staff (team_id, name, role, annual_entitlement)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [teamId || null, name.trim(), r, ent]
    );
    return res.status(201).json(s);
  } catch (err) { next(err); }
}

async function updateStaff(req, res, next) {
  try {
    const { name, role, teamId, annualEntitlement, isActive } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined)              { params.push(name.trim());   updates.push(`name=$${params.length}`); }
    if (role !== undefined)              { params.push(role);          updates.push(`role=$${params.length}`); }
    if (teamId !== undefined)            { params.push(teamId);        updates.push(`team_id=$${params.length}`); }
    if (annualEntitlement !== undefined) { params.push(annualEntitlement); updates.push(`annual_entitlement=$${params.length}`); }
    if (isActive !== undefined)          { params.push(isActive);      updates.push(`is_active=$${params.length}`); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id);
    const { rows: [s] } = await db.query(
      `UPDATE lms_staff SET ${updates.join(', ')} WHERE id=$${params.length} RETURNING *`, params
    );
    if (!s) return res.status(404).json({ error: 'Staff not found.' });
    return res.json(s);
  } catch (err) { next(err); }
}

async function removeStaff(req, res, next) {
  try {
    await db.query('UPDATE lms_staff SET is_active=FALSE WHERE id=$1', [req.params.id]);
    return res.json({ message: 'Staff deactivated.' });
  } catch (err) { next(err); }
}

// ─── Public Holidays ──────────────────────────────────────────────────────────
async function getHolidays(req, res, next) {
  try {
    const { rows } = await db.query('SELECT * FROM lms_public_holidays ORDER BY date');
    return res.json(rows);
  } catch (err) { next(err); }
}

async function addHoliday(req, res, next) {
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'date and name are required.' });
    const { rows: [h] } = await db.query(
      'INSERT INTO lms_public_holidays (date, name) VALUES ($1,$2) RETURNING *', [date, name]
    );
    return res.status(201).json(h);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Holiday already exists for this date.' });
    next(err);
  }
}

async function deleteHoliday(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM lms_public_holidays WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Holiday not found.' });
    return res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

// ─── Absence Management ───────────────────────────────────────────────────────
async function listAbsences(req, res, next) {
  try {
    const { from, to, teamId, staffId, reason, status } = req.query;
    const conds = []; const params = [];
    const add = v => { params.push(v); return `$${params.length}`; };

    if (from)    conds.push(`a.start_date >= ${add(from)}`);
    if (to)      conds.push(`a.start_date <= ${add(to)}`);
    if (staffId) conds.push(`a.staff_id = ${add(parseInt(staffId))}`);
    if (reason)  conds.push(`a.reason = ${add(reason)}`);
    if (status)  conds.push(`a.status = ${add(status)}`);
    if (teamId)  conds.push(`s.team_id = ${add(parseInt(teamId))}`);

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT a.*, s.name AS staff_name, s.role AS staff_role,
             t.name AS team_name, d.name AS dept_name
      FROM lms_absences a
      JOIN lms_staff s ON s.id = a.staff_id
      LEFT JOIN lms_teams t ON t.id = s.team_id
      LEFT JOIN lms_departments d ON d.id = t.department_id
      ${where}
      ORDER BY a.start_date DESC, s.name
      LIMIT 500
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function logAbsence(req, res, next) {
  try {
    const { staffId, startDate, endDate, days, reason, notes, shiftMissed } = req.body;
    if (!staffId || !startDate || !reason) {
      return res.status(400).json({ error: 'staffId, startDate and reason are required.' });
    }
    const end  = endDate || startDate;
    const d    = days != null ? parseInt(days) : 1;
    const { rows: [rec] } = await db.query(`
      INSERT INTO lms_absences
        (staff_id, start_date, end_date, days, reason, notes, shift_missed, logged_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [staffId, startDate, end, d, reason, notes||null, shiftMissed||null,
        req.user.fullName || req.user.username]);
    return res.status(201).json(rec);
  } catch (err) { next(err); }
}

async function updateAbsence(req, res, next) {
  try {
    const { status, notes } = req.body;
    const { rows: [rec] } = await db.query(`
      UPDATE lms_absences SET status=$1, notes=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [status, notes||null, req.params.id]);
    if (!rec) return res.status(404).json({ error: 'Absence record not found.' });
    return res.json(rec);
  } catch (err) { next(err); }
}

async function deleteAbsence(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM lms_absences WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Absence record not found.' });
    return res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

async function getAbsenceAnalytics(req, res, next) {
  try {
    const { from, to, teamId } = req.query;
    const teamCond  = teamId ? `AND s.team_id = ${parseInt(teamId)}` : '';
    const fromDate  = from || new Date(Date.now() - 365*24*60*60*1000).toISOString().slice(0,10);
    const toDate    = to   || new Date().toISOString().slice(0,10);

    // Per-staff frequency + Bradford Factor
    const { rows: staffStats } = await db.query(`
      SELECT s.id, s.name AS staff_name, t.name AS team_name,
        COUNT(a.id)::int             AS absence_spells,
        COALESCE(SUM(a.days),0)::int AS total_days,
        (COUNT(a.id)^2 * COALESCE(SUM(a.days),0))::int AS bradford_factor
      FROM lms_staff s
      LEFT JOIN lms_absences a ON a.staff_id = s.id
        AND a.start_date BETWEEN $1 AND $2
      LEFT JOIN lms_teams t ON t.id = s.team_id
      WHERE s.is_active = TRUE ${teamCond}
      GROUP BY s.id, s.name, t.name
      HAVING COUNT(a.id) > 0
      ORDER BY bradford_factor DESC, total_days DESC
      LIMIT 20
    `, [fromDate, toDate]);

    // Reason breakdown
    const { rows: reasonBreakdown } = await db.query(`
      SELECT a.reason, COUNT(*)::int AS count, SUM(a.days)::int AS total_days
      FROM lms_absences a
      JOIN lms_staff s ON s.id = a.staff_id
      WHERE a.start_date BETWEEN $1 AND $2 ${teamCond.replace('AND s.team_id', 'AND s.team_id')}
      GROUP BY a.reason ORDER BY count DESC
    `, [fromDate, toDate]);

    // Day-of-week pattern
    const { rows: dowPattern } = await db.query(`
      SELECT EXTRACT(DOW FROM a.start_date)::int AS dow, COUNT(*)::int AS count
      FROM lms_absences a
      JOIN lms_staff s ON s.id = a.staff_id
      WHERE a.start_date BETWEEN $1 AND $2 ${teamCond}
      GROUP BY dow ORDER BY dow
    `, [fromDate, toDate]);

    // Monthly trend
    const { rows: monthlyTrend } = await db.query(`
      SELECT TO_CHAR(a.start_date,'YYYY-MM') AS month,
             COUNT(*)::int AS spells, SUM(a.days)::int AS total_days
      FROM lms_absences a
      JOIN lms_staff s ON s.id = a.staff_id
      WHERE a.start_date BETWEEN $1 AND $2 ${teamCond}
      GROUP BY month ORDER BY month
    `, [fromDate, toDate]);

    return res.json({ staffStats, reasonBreakdown, dowPattern, monthlyTrend, from: fromDate, to: toDate });
  } catch (err) { next(err); }
}

// ─── Staff Leave History ──────────────────────────────────────────────────────
async function getStaffHistory(req, res, next) {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const yr    = new Date().getFullYear();

    const { rows: [staff] } = await db.query(`
      SELECT s.*, t.name AS team_name, d.name AS dept_name
      FROM lms_staff s
      LEFT JOIN lms_teams t ON t.id = s.team_id
      LEFT JOIN lms_departments d ON d.id = t.department_id
      WHERE s.id = $1
    `, [id]);
    if (!staff) return res.status(404).json({ error: 'Staff not found.' });

    const { rows: requests } = await db.query(`
      SELECT * FROM lms_leave_requests
      WHERE staff_id = $1
      ORDER BY start_date DESC
    `, [id]);

    // Balance for each of past, current, next year
    const balances = {};
    for (const year of [yr - 1, yr, yr + 1]) {
      const prevUsed = requests
        .filter(r => r.status==='Approved' && !r.is_gift_leave &&
          (r.entitlement_year === year-1 || (!r.entitlement_year && r.year === year-1)))
        .reduce((s, r) => s + r.working_days, 0);
      const used = requests
        .filter(r => r.status==='Approved' && !r.is_gift_leave &&
          (r.entitlement_year === year || (!r.entitlement_year && r.year === year)))
        .reduce((s, r) => s + r.working_days, 0);
      const carryOver  = Math.max(0, staff.annual_entitlement - prevUsed);
      const total      = staff.annual_entitlement + carryOver;
      balances[year]   = { entitlement: staff.annual_entitlement, carry_over: carryOver, total, used, remaining: total - used };
    }

    const upcoming = requests.filter(r => r.status === 'Approved' && r.start_date > today);
    return res.json({ staff, requests, balances, upcoming, today });
  } catch (err) { next(err); }
}

// ─── Shift Schedule ───────────────────────────────────────────────────────────
const VALID_SHIFTS = new Set([
  'days_exp','days_imp','days_int','days',
  'nights_exp','nights_imp','nights_int','nights',
  'rest','flexi',
]);

function normalizeShift(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s || s === '-') return null;
  if (s.includes('rest'))                              return 'rest';
  if (s === 'flexi')                                   return 'flexi';
  if (s.includes('day') && s.includes('exp'))          return 'days_exp';
  if (s.includes('day') && s.includes('imp'))          return 'days_imp';
  if (s.includes('day') && s.includes('int'))          return 'days_int';
  if (s.includes('day'))                               return 'days';
  if ((s.includes('night') || s.includes('nigh')) && s.includes('exp')) return 'nights_exp';
  if ((s.includes('night') || s.includes('nigh')) && s.includes('imp')) return 'nights_imp';
  if ((s.includes('night') || s.includes('nigh')) && s.includes('int')) return 'nights_int';
  if (s.includes('night') || s.includes('nigh'))       return 'nights';
  return null;
}

async function getShifts(req, res, next) {
  try {
    const { month, teamId } = req.query;
    if (!month || !teamId) return res.status(400).json({ error: 'month and teamId are required.' });
    const [y, m] = month.split('-').map(Number);
    const start  = `${y}-${String(m).padStart(2,'0')}-01`;
    const end    = new Date(y, m, 0).toISOString().slice(0, 10);

    const { rows } = await db.query(`
      SELECT sh.shift_date::text AS shift_date, sh.shift_type,
             s.id AS staff_id, s.name AS staff_name, s.role AS staff_role
      FROM lms_shifts sh
      JOIN lms_staff s ON s.id = sh.staff_id
      WHERE s.team_id = $1
        AND sh.shift_date BETWEEN $2 AND $3
        AND s.is_active = TRUE
      ORDER BY s.name, sh.shift_date
    `, [teamId, start, end]);

    return res.json({ month, teamId: parseInt(teamId), rows });
  } catch (err) { next(err); }
}

async function importShifts(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { month, teamId, entries } = req.body;
    // entries: [{ staffId, shifts: ['rest','days_exp', ...] }]
    if (!month || !teamId || !Array.isArray(entries) || !entries.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'month, teamId and entries[] are required.' });
    }

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const pad = n => String(n).padStart(2,'0');
    let inserted = 0;

    for (const { staffId, shifts } of entries) {
      for (let d = 1; d <= Math.min(shifts.length, daysInMonth); d++) {
        const shiftType = normalizeShift(shifts[d - 1]);
        if (!shiftType) continue;
        const dateStr = `${y}-${pad(m)}-${pad(d)}`;
        await client.query(`
          INSERT INTO lms_shifts (staff_id, shift_date, shift_type)
          VALUES ($1, $2, $3)
          ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type = EXCLUDED.shift_type
        `, [staffId, dateStr, shiftType]);
        inserted++;
      }
    }

    await client.query('COMMIT');
    return res.json({ inserted, month, teamId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

async function clearShifts(req, res, next) {
  try {
    const { month, teamId } = req.query;
    if (!month || !teamId) return res.status(400).json({ error: 'month and teamId are required.' });
    const [y, m] = month.split('-').map(Number);
    const start  = `${y}-${String(m).padStart(2,'0')}-01`;
    const end    = new Date(y, m, 0).toISOString().slice(0, 10);
    const { rowCount } = await db.query(`
      DELETE FROM lms_shifts
      WHERE shift_date BETWEEN $1 AND $2
        AND staff_id IN (SELECT id FROM lms_staff WHERE team_id = $3)
    `, [start, end, teamId]);
    return res.json({ deleted: rowCount });
  } catch (err) { next(err); }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
async function getCalendar(req, res, next) {
  try {
    const raw   = req.query.month || new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const [y, m] = raw.split('-').map(Number);
    const start  = `${y}-${String(m).padStart(2,'0')}-01`;
    const end    = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month

    const { rows: records } = await db.query(`
      SELECT lr.id, lr.start_date, lr.end_date, lr.leave_type, lr.working_days,
             lr.is_gift_leave, s.name AS staff_name, s.role AS staff_role,
             t.name AS team_name, d.name AS dept_name
      FROM lms_leave_requests lr
      JOIN lms_staff s ON s.id = lr.staff_id
      LEFT JOIN lms_teams t ON t.id = s.team_id
      LEFT JOIN lms_departments d ON d.id = t.department_id
      WHERE lr.status = 'Approved'
        AND lr.start_date <= $2
        AND lr.end_date   >= $1
      ORDER BY t.name, s.name
    `, [start, end]);

    const { rows: holidays } = await db.query(
      `SELECT date::text AS date, name FROM lms_public_holidays
       WHERE date >= $1 AND date <= $2 ORDER BY date`,
      [start, end]
    );

    return res.json({ month: raw, start, end, records, holidays });
  } catch (err) { next(err); }
}

module.exports = {
  ensureSchema, ROLE_LABELS, entitlementForRole,
  listAbsences, logAbsence, updateAbsence, deleteAbsence, getAbsenceAnalytics,
  getStaffHistory,
  getShifts, importShifts, clearShifts,
  getCalendar,
  getOverview, getRequests, submitRequest, approveRequest, rejectRequest, deleteRequest,
  getBalances,
  getDepartments, createDepartment, deleteDepartment, addTeam, deleteTeam,
  replaceTeamRoster,
  getStaff, addStaff, updateStaff, removeStaff,
  getHolidays, addHoliday, deleteHoliday,
};
