const db = require('../config/database');

// ─── Seed data ────────────────────────────────────────────────────────────────
const ATOMIC_PERMISSIONS = [
  // Truck
  { name: 'truck.view',           description: 'View truck allocations' },
  { name: 'truck.create',         description: 'Create truck allocation' },
  { name: 'truck.edit',           description: 'Edit truck details' },
  { name: 'truck.delete',         description: 'Delete truck allocation' },
  { name: 'truck.release',        description: 'Release truck from bay' },
  { name: 'truck.bay_assign',     description: 'Assign truck to a bay' },
  { name: 'truck.dwell_override', description: 'Override truck dwell time' },
  // Allocation
  { name: 'allocation.view',      description: 'View allocations and chits' },
  { name: 'allocation.create',    description: 'Create new allocation / bay assignment' },
  { name: 'allocation.edit',      description: 'Edit existing allocation' },
  { name: 'allocation.delete',    description: 'Delete allocation record' },
  { name: 'allocation.chit_print',description: 'Print waybill / chit' },
  { name: 'allocation.override',  description: 'Override allocation status' },
  // Gate
  { name: 'gate.view',            description: 'View gate operations queue' },
  { name: 'gate.check_in',        description: 'Check in container at gate' },
  { name: 'gate.check_out',       description: 'Confirm container exit at gate' },
  { name: 'gate.override',        description: 'Override gate entry/exit decisions' },
  // Container
  { name: 'container.view',       description: 'View container transactions' },
  { name: 'container.create',     description: 'Create container transaction' },
  { name: 'container.edit',       description: 'Edit container details' },
  { name: 'container.delete',     description: 'Delete container record' },
  { name: 'container.override',   description: 'Override container status' },
  { name: 'container.reinstate',  description: 'Reinstate exited container' },
  // Bay
  { name: 'bay.view',             description: 'View bays and occupancy' },
  { name: 'bay.assign',           description: 'Assign container to bay' },
  { name: 'bay.release',          description: 'Release bay from container' },
  { name: 'bay.manage',           description: 'Create and configure bays' },
  // Holding area
  { name: 'holding_area.view',    description: 'View holding areas' },
  { name: 'holding_area.manage',  description: 'Manage holding area configuration' },
  // Marshal
  { name: 'marshal.view',           description: 'View marshal operations' },
  { name: 'marshal.confirm_entry',  description: 'Confirm container entry at holding area' },
  { name: 'marshal.start_examination',    description: 'Start container examination' },
  { name: 'marshal.complete_examination', description: 'Complete container examination' },
  { name: 'marshal.confirm_exit',   description: 'Confirm container exit from holding area' },
  // Dashboard
  { name: 'dashboard.view',       description: 'View operations dashboard' },
  // Report
  { name: 'report.view',          description: 'View standard reports' },
  { name: 'report.analytics',     description: 'View analytics and KPI dashboards' },
  { name: 'report.export',        description: 'Export reports to file' },
  { name: 'report.pdf',           description: 'Generate PDF reports' },
  { name: 'report.email_config',  description: 'Configure email alerts and daily reports' },
  { name: 'report.schedule',      description: 'Schedule automated report delivery' },
  // Audit
  { name: 'audit.view',           description: 'View audit logs' },
  { name: 'audit.export',         description: 'Export audit logs' },
  // User
  { name: 'user.view',            description: 'View user accounts' },
  { name: 'user.create',          description: 'Create user accounts' },
  { name: 'user.edit',            description: 'Edit user accounts' },
  { name: 'user.delete',          description: 'Delete user accounts' },
  { name: 'user.password_reset',  description: 'Reset user passwords' },
  { name: 'user.unlock',          description: 'Unlock locked accounts' },
  { name: 'user.session_kill',    description: 'Terminate active sessions' },
  // Role
  { name: 'role.view',            description: 'View roles and their permissions' },
  { name: 'role.create',          description: 'Create new roles' },
  { name: 'role.edit',            description: 'Edit existing roles' },
  { name: 'role.delete',          description: 'Delete non-system roles' },
  // Permission
  { name: 'permission.view',      description: 'View permission definitions and groups' },
  { name: 'permission.assign',    description: 'Assign permissions to roles and users' },
  { name: 'permission.group_manage', description: 'Create and edit permission groups' },
  // Config
  { name: 'config.view',          description: 'View system configuration' },
  { name: 'config.edit',          description: 'Edit system configuration' },
  // Session
  { name: 'session.view',         description: 'View active sessions' },
  { name: 'session.manage',       description: 'Manage and terminate sessions' },
  // Leave
  { name: 'leave.view',                  description: 'View leave records and balances' },
  { name: 'leave.submit',                description: 'Submit leave requests' },
  { name: 'leave.approve',               description: 'Approve or reject leave requests' },
  { name: 'leave.manage_roster',         description: 'Manage leave staff roster' },
  { name: 'leave.manage_holidays',       description: 'Manage public holidays' },
  // Inventory — Parts master
  { name: 'part.view',                   description: 'View spare parts catalogue' },
  { name: 'part.create',                 description: 'Create spare parts records' },
  { name: 'part.edit',                   description: 'Edit spare parts records' },
  { name: 'part.delete',                 description: 'Obsolete / delete spare parts' },
  // Inventory — Stock movements
  { name: 'stock.view',                  description: 'View stock balances and movement history' },
  { name: 'stock.receive',               description: 'Receive stock in (STOCK_IN transactions)' },
  { name: 'stock.issue',                 description: 'Issue stock out (STOCK_OUT transactions)' },
  { name: 'stock.adjust',                description: 'Make cycle-count stock adjustments' },
  { name: 'stock.transfer',              description: 'Transfer stock between locations' },
  { name: 'stock.reserve',               description: 'Create and cancel stock reservations' },
  { name: 'stock.approve',               description: 'Approve high-value stock adjustments' },
  // Inventory — Suppliers & Equipment
  { name: 'supplier.view',               description: 'View supplier records' },
  { name: 'supplier.create',             description: 'Create supplier records' },
  { name: 'supplier.edit',               description: 'Edit supplier records' },
  { name: 'equipment.inventory_view',    description: 'View equipment master for inventory' },
  { name: 'equipment.inventory_manage',  description: 'Create and edit equipment records' },
  // Inventory — Reports & Alerts
  { name: 'report.inventory_view',       description: 'View inventory reports and analytics' },
  { name: 'report.inventory_export',     description: 'Export inventory reports to file' },
  { name: 'alert.inventory_view',        description: 'View inventory alerts and reorder notifications' },
  { name: 'settings.inventory',          description: 'Manage inventory settings and storage locations' },
];

const PERMISSION_GROUPS = {
  'Gate Operations': [
    'gate.view','gate.check_in','gate.check_out',
    'container.view','container.create','dashboard.view',
  ],
  'Allocation Management': [
    'allocation.view','allocation.create','allocation.edit','allocation.chit_print',
    'truck.view','truck.create','truck.release','truck.bay_assign',
    'bay.view','bay.assign','bay.release',
  ],
  'Marshal Operations': [
    'marshal.view','marshal.confirm_entry','marshal.start_examination',
    'marshal.complete_examination','marshal.confirm_exit',
    'holding_area.view','bay.view','container.view',
  ],
  'Reporting': [
    'report.view','report.analytics','report.export','report.pdf',
    'audit.view','dashboard.view',
  ],
  'Leave Management': [
    'leave.view','leave.submit',
  ],
  'User Administration': [
    'user.view','user.create','user.edit','user.password_reset',
    'user.unlock','role.view','permission.view',
  ],
  'System Administration': [
    'user.view','user.create','user.edit','user.delete',
    'user.password_reset','user.unlock','user.session_kill',
    'role.view','role.create','role.edit','role.delete',
    'permission.view','permission.assign','permission.group_manage',
    'config.view','config.edit','audit.view','audit.export',
    'session.view','session.manage','report.email_config','report.schedule',
  ],
  'Storekeeper': [
    'part.view','stock.view','stock.receive','stock.issue',
    'stock.reserve','alert.inventory_view','report.inventory_view',
    'supplier.view','equipment.inventory_view',
  ],
  'Inventory Management': [
    'part.view','part.create','part.edit',
    'stock.view','stock.receive','stock.issue','stock.adjust',
    'stock.transfer','stock.reserve','stock.approve',
    'supplier.view','supplier.create','supplier.edit',
    'equipment.inventory_view','equipment.inventory_manage',
    'report.inventory_view','report.inventory_export',
    'alert.inventory_view','settings.inventory',
  ],
  'Compliance Management': [
    'compliance.view','compliance.edit','compliance.submit_application',
    'compliance.upload_certificate','compliance.delete',
    'maintenance.log','maintenance.view',
    'breakdown.log','breakdown.edit','breakdown.close',
    'repair.log','repair.edit',
    'calibration.log','calibration.upload',
    'report.compliance_view','report.generate','report.submit',
    'settings.compliance_manage',
  ],
};

const DEFAULT_ROLES = [
  {
    name: 'admin',
    description: 'Full system access — cannot be deleted.',
    is_system: true,
    groups: Object.keys(PERMISSION_GROUPS),
    extra_grants: [
      'truck.edit','truck.delete','truck.dwell_override',
      'allocation.delete','allocation.override',
      'gate.override','container.override','container.reinstate',
      'container.edit','container.delete',
      'holding_area.manage','bay.manage',
      'leave.approve','leave.manage_roster','leave.manage_holidays',
      'part.delete',
    ],
    denies: [],
  },
  {
    name: 'supervisor',
    description: 'Operational supervisor with reporting and leave approval.',
    is_system: true,
    groups: ['Gate Operations','Allocation Management','Marshal Operations','Reporting','Leave Management'],
    extra_grants: [
      'truck.dwell_override','allocation.override','container.override',
      'container.reinstate','audit.view','report.email_config',
      'leave.approve','leave.manage_roster','leave.manage_holidays',
      'compliance.view','maintenance.view','report.compliance_view',
    ],
    denies: ['user.delete','role.delete','permission.assign','config.edit'],
  },
  {
    name: 'booth_officer',
    description: 'Handles gate check-in and bay allocation.',
    is_system: true,
    groups: ['Gate Operations','Allocation Management'],
    extra_grants: ['allocation.chit_print'],
    denies: ['gate.override','container.override','allocation.delete','truck.delete'],
  },
  {
    name: 'marshal',
    description: 'Manages holding area entry, examination, and exit.',
    is_system: true,
    groups: ['Marshal Operations'],
    extra_grants: ['dashboard.view'],
    denies: ['gate.check_in','allocation.create','allocation.edit','truck.create','bay.assign'],
  },
];

// ─── Effective permissions SQL ────────────────────────────────────────────────
// Used by both auth middleware and the API endpoint
const EFFECTIVE_PERMS_SQL = `
  WITH RECURSIVE role_chain AS (
    SELECT r.id, r.inherits_from, 1 AS depth
    FROM roles r
    JOIN users u ON u.role_id = r.id
    WHERE u.id = $1

    UNION ALL

    SELECT r.id, r.inherits_from, rc.depth + 1
    FROM roles r
    JOIN role_chain rc ON r.id = rc.inherits_from
    WHERE rc.depth < 5 AND rc.inherits_from IS NOT NULL
  ),
  group_perms AS (
    SELECT DISTINCT p.name
    FROM role_chain rc
    JOIN role_permission_groups rpg ON rpg.role_id = rc.id
    JOIN permission_group_members pgm ON pgm.group_id = rpg.group_id
    JOIN permissions p ON p.id = pgm.permission_id
  ),
  direct_grants AS (
    SELECT DISTINCT p.name
    FROM role_chain rc
    JOIN role_permissions rp ON rp.role_id = rc.id AND rp.type = 'grant'
    JOIN permissions p ON p.id = rp.permission_id
  ),
  role_denies AS (
    SELECT DISTINCT p.name
    FROM role_chain rc
    JOIN role_permissions rp ON rp.role_id = rc.id AND rp.type = 'deny'
    JOIN permissions p ON p.id = rp.permission_id
  ),
  base_effective AS (
    SELECT name FROM group_perms
    UNION
    SELECT name FROM direct_grants
    EXCEPT
    SELECT name FROM role_denies
  ),
  user_grants AS (
    SELECT p.name
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = $1 AND upo.type = 'grant'
      AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
  ),
  user_denies AS (
    SELECT p.name
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = $1 AND upo.type = 'deny'
      AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
  )
  SELECT name FROM (
    SELECT name FROM base_effective
    UNION
    SELECT name FROM user_grants
  ) combined
  WHERE name NOT IN (SELECT name FROM user_denies)
  ORDER BY name
`;

// ─── Schema setup ─────────────────────────────────────────────────────────────
async function ensureRbacSchema() {
  const client = await db.getClient();
  try {
    // Extend roles table
    await client.query(`
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS inherits_from INT REFERENCES roles(id) ON DELETE SET NULL;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    // Extend role_permissions with type
    await client.query(`
      ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'grant'
        CHECK (type IN ('grant','deny'));
    `);

    // Extend roles table with extra columns
    await client.query(`
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // New tables (users.id is UUID — all FK references must be UUID)
    await client.query(`
      CREATE TABLE IF NOT EXISTS permission_groups (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS permission_group_members (
        group_id      INT REFERENCES permission_groups(id) ON DELETE CASCADE,
        permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, permission_id)
      );
      CREATE TABLE IF NOT EXISTS role_permission_groups (
        role_id  INT REFERENCES roles(id) ON DELETE CASCADE,
        group_id INT REFERENCES permission_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, group_id)
      );
      CREATE TABLE IF NOT EXISTS user_permission_overrides (
        id            SERIAL PRIMARY KEY,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        type          VARCHAR(10) NOT NULL CHECK (type IN ('grant','deny')),
        reason        TEXT,
        granted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at    TIMESTAMPTZ,
        context       JSONB,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, permission_id)
      );
      CREATE TABLE IF NOT EXISTS role_versions (
        id            SERIAL PRIMARY KEY,
        role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        version       INT NOT NULL,
        snapshot      JSONB NOT NULL,
        changed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
        change_reason TEXT,
        changed_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Migrate old permission codes to dot notation ──
    const RENAMES = [
      ['dashboard:view',              'dashboard.view'],
      ['container:view',              'container.view'],
      ['container:allocate',          'allocation.create'],
      ['container:confirm_entry',     'marshal.confirm_entry'],
      ['container:start_examination', 'marshal.start_examination'],
      ['container:complete_examination','marshal.complete_examination'],
      ['container:release',           'marshal.confirm_exit'],
      ['container:override',          'container.override'],
      ['container:reinstate',         'container.reinstate'],
      ['users:view',                  'user.view'],
      ['users:edit',                  'user.edit'],
      ['users:create',                'user.create'],
      ['reports:view',                'report.view'],
      ['audit:view',                  'audit.view'],
      ['config:view',                 'config.view'],
      ['config:edit',                 'config.edit'],
    ];
    for (const [old, newCode] of RENAMES) {
      await client.query(
        `UPDATE permissions SET name = $1 WHERE name = $2`, [newCode, old]
      );
    }

    // ── Seed missing atomic permissions ──
    for (const perm of ATOMIC_PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (name, description)
         VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [perm.name, perm.description]
      );
    }

    // ── Seed permission groups ──
    for (const [groupName, permCodes] of Object.entries(PERMISSION_GROUPS)) {
      const { rows: [grp] } = await client.query(
        `INSERT INTO permission_groups (name)
         VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [groupName]
      );
      // Clear and re-seed members (idempotent)
      await client.query('DELETE FROM permission_group_members WHERE group_id = $1', [grp.id]);
      for (const code of permCodes) {
        await client.query(
          `INSERT INTO permission_group_members (group_id, permission_id)
           SELECT $1, id FROM permissions WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [grp.id, code]
        );
      }
    }

    // ── Seed default roles with groups + grants + denies ──
    for (const roleDef of DEFAULT_ROLES) {
      const { rows: [role] } = await client.query(
        `UPDATE roles SET is_system = $1, description = $2 WHERE name = $3 RETURNING id`,
        [roleDef.is_system, roleDef.description, roleDef.name]
      );
      if (!role) continue;

      // Assign permission groups table (for UI only)
      await client.query('DELETE FROM role_permission_groups WHERE role_id = $1', [role.id]);
      for (const groupName of roleDef.groups) {
        await client.query(
          `INSERT INTO role_permission_groups (role_id, group_id)
           SELECT $1, id FROM permission_groups WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [role.id, groupName]
        );
      }

      // Expand groups into a flat permission set (source of truth → role_permissions)
      const allGrants = new Set();
      for (const groupName of roleDef.groups) {
        (PERMISSION_GROUPS[groupName] || []).forEach(p => allGrants.add(p));
      }
      roleDef.extra_grants.forEach(p => allGrants.add(p));
      roleDef.denies.forEach(p => allGrants.delete(p)); // denies win

      // Wipe and re-seed role_permissions for this role
      await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [role.id]);
      for (const code of allGrants) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, type)
           SELECT $1, id, 'grant' FROM permissions WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [role.id, code]
        );
      }
      for (const code of roleDef.denies) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id, type)
           SELECT $1, id, 'deny' FROM permissions WHERE name = $2
           ON CONFLICT (role_id, permission_id) DO UPDATE SET type = 'deny'`,
          [role.id, code]
        );
      }
    }
  } finally {
    client.release();
  }
}

// ─── Effective permissions ────────────────────────────────────────────────────
async function computeEffectivePermissions(userId) {
  const { rows } = await db.query(EFFECTIVE_PERMS_SQL, [userId]);
  return rows.map(r => r.name);
}

// ─── Permissions CRUD ─────────────────────────────────────────────────────────
async function listPermissions(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.description,
              SPLIT_PART(p.name, '.', 1) AS module,
              SPLIT_PART(p.name, '.', 2) AS action
       FROM permissions p ORDER BY p.name`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── Permission Groups CRUD ───────────────────────────────────────────────────
async function listGroups(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT pg.id, pg.name, pg.description, pg.created_at,
              COALESCE(json_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL), '[]') AS permissions
       FROM permission_groups pg
       LEFT JOIN permission_group_members pgm ON pgm.group_id = pg.id
       LEFT JOIN permissions p ON p.id = pgm.permission_id
       GROUP BY pg.id ORDER BY pg.name`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createGroup(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { name, description, permissions = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });

    const { rows: [grp] } = await client.query(
      `INSERT INTO permission_groups (name, description, created_by)
       VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), description || null, req.user.id]
    );
    for (const code of permissions) {
      await client.query(
        `INSERT INTO permission_group_members (group_id, permission_id)
         SELECT $1, id FROM permissions WHERE name = $2 ON CONFLICT DO NOTHING`,
        [grp.id, code]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ ...grp, permissions });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Group name already exists.' });
    next(err);
  } finally { client.release(); }
}

async function updateGroup(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { name, description, permissions } = req.body;
    const updates = []; const params = [];
    if (name !== undefined) { params.push(name.trim()); updates.push(`name=$${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description=$${params.length}`); }
    if (updates.length) {
      params.push(req.params.id);
      await client.query(`UPDATE permission_groups SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    }
    if (permissions !== undefined) {
      await client.query('DELETE FROM permission_group_members WHERE group_id = $1', [req.params.id]);
      for (const code of permissions) {
        await client.query(
          `INSERT INTO permission_group_members (group_id, permission_id)
           SELECT $1, id FROM permissions WHERE name = $2 ON CONFLICT DO NOTHING`,
          [req.params.id, code]
        );
      }
    }
    await client.query('COMMIT');
    return res.json({ message: 'Group updated.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

async function deleteGroup(req, res, next) {
  try {
    const { rowCount } = await db.query('DELETE FROM permission_groups WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Group not found.' });
    return res.json({ message: 'Group deleted.' });
  } catch (err) { next(err); }
}

// ─── Role CRUD ────────────────────────────────────────────────────────────────
async function listRoles(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system, r.version,
              r.inherits_from, p.name AS inherits_from_name,
              r.created_at,
              (SELECT COUNT(*)::int FROM users u WHERE u.role_id = r.id AND u.is_active = TRUE) AS user_count,
              (SELECT json_agg(g.name ORDER BY g.name) FROM role_permission_groups rpg
               JOIN permission_groups g ON g.id = rpg.group_id WHERE rpg.role_id = r.id) AS groups,
              (SELECT json_agg(json_build_object('code', pm.name, 'type', rp.type) ORDER BY pm.name)
               FROM role_permissions rp JOIN permissions pm ON pm.id = rp.permission_id WHERE rp.role_id = r.id) AS direct_permissions
       FROM roles r
       LEFT JOIN roles p ON p.id = r.inherits_from
       ORDER BY r.is_system DESC, r.name`
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getRole(req, res, next) {
  try {
    const { rows: [role] } = await db.query(
      `SELECT r.*, p.name AS inherits_from_name FROM roles r
       LEFT JOIN roles p ON p.id = r.inherits_from WHERE r.id = $1`, [req.params.id]
    );
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    const { rows: groups } = await db.query(
      `SELECT g.id, g.name FROM role_permission_groups rpg
       JOIN permission_groups g ON g.id = rpg.group_id WHERE rpg.role_id = $1 ORDER BY g.name`, [role.id]
    );
    const { rows: directs } = await db.query(
      `SELECT p.name AS code, rp.type FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`, [role.id]
    );
    const { rows: versions } = await db.query(
      `SELECT version, changed_at, change_reason, changed_by FROM role_versions
       WHERE role_id = $1 ORDER BY version DESC LIMIT 10`, [role.id]
    );

    // Effective permissions for this role (simulate as user with this role)
    return res.json({
      ...role,
      groups,
      direct_grants: directs.filter(d => d.type === 'grant').map(d => d.code),
      direct_denies: directs.filter(d => d.type === 'deny').map(d => d.code),
      versions,
    });
  } catch (err) { next(err); }
}

async function createRole(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { name, description, inheritsFrom, groups = [], grants = [], denies = [] } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Role name is required.' });

    // Validate no circular inheritance
    if (inheritsFrom) {
      const chain = await _getInheritanceChain(client, inheritsFrom);
      if (chain.length >= 5) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Inheritance chain exceeds maximum depth of 5.' });
      }
    }

    const { rows: [role] } = await client.query(
      `INSERT INTO roles (name, description, inherits_from, is_system, created_by)
       VALUES ($1,$2,$3,FALSE,$4) RETURNING *`,
      [name.trim(), description || null, inheritsFrom || null, req.user.id]
    );

    await _applyRolePermissions(client, role.id, groups, grants, denies);
    await _snapshotRole(client, role.id, 1, req.user.id, 'Created');

    await client.query('COMMIT');
    return res.status(201).json(role);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Role name already exists.' });
    next(err);
  } finally { client.release(); }
}

async function updateRole(req, res, next) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { name, description, inheritsFrom, groups, grants, denies, changeReason } = req.body;

    const { rows: [existing] } = await client.query('SELECT * FROM roles WHERE id=$1', [id]);
    if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Role not found.' }); }

    // Circular inheritance check
    if (inheritsFrom !== undefined && inheritsFrom !== null) {
      if (parseInt(inheritsFrom) === parseInt(id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'A role cannot inherit from itself.' });
      }
      const chain = await _getInheritanceChain(client, inheritsFrom);
      if (chain.includes(parseInt(id))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Circular inheritance detected.' });
      }
    }

    const updates = []; const params = [];
    if (name !== undefined)        { params.push(name.trim());   updates.push(`name=$${params.length}`); }
    if (description !== undefined) { params.push(description);   updates.push(`description=$${params.length}`); }
    if (inheritsFrom !== undefined){ params.push(inheritsFrom);  updates.push(`inherits_from=$${params.length}`); }
    updates.push(`version = version + 1`);
    updates.push(`updated_at = NOW()`);

    if (params.length > 0) {
      params.push(id);
      await client.query(`UPDATE roles SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    }

    if (groups !== undefined || grants !== undefined || denies !== undefined) {
      await _applyRolePermissions(client, id, groups, grants, denies);
    }

    const { rows: [updated] } = await client.query('SELECT version FROM roles WHERE id=$1', [id]);
    await _snapshotRole(client, id, updated.version, req.user.id, changeReason || 'Updated');

    await client.query('COMMIT');
    return res.json({ message: 'Role updated.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { client.release(); }
}

async function deleteRole(req, res, next) {
  try {
    const { rows: [role] } = await db.query('SELECT * FROM roles WHERE id=$1', [req.params.id]);
    if (!role) return res.status(404).json({ error: 'Role not found.' });
    if (role.is_system) return res.status(403).json({ error: 'System roles cannot be deleted.' });

    const { rows: [{ cnt }] } = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM users WHERE role_id=$1 AND is_active=TRUE', [req.params.id]
    );
    if (cnt > 0) return res.status(409).json({
      error: `${cnt} active user(s) have this role. Reassign them before deleting.`, userCount: cnt,
    });

    await db.query('DELETE FROM roles WHERE id=$1', [req.params.id]);
    return res.json({ message: 'Role deleted.' });
  } catch (err) { next(err); }
}

async function getRoleHistory(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT rv.*, u.username AS changed_by_username
       FROM role_versions rv LEFT JOIN users u ON u.id = rv.changed_by
       WHERE rv.role_id = $1 ORDER BY rv.version DESC`, [req.params.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

// ─── User overrides ───────────────────────────────────────────────────────────
async function getUserOverrides(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT upo.id, p.name AS permission, upo.type, upo.reason, upo.expires_at,
              u.username AS granted_by_username, upo.created_at
       FROM user_permission_overrides upo
       JOIN permissions p ON p.id = upo.permission_id
       LEFT JOIN users u ON u.id = upo.granted_by
       WHERE upo.user_id = $1 ORDER BY upo.type, p.name`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

async function setUserOverride(req, res, next) {
  try {
    const { permission, type, reason, expiresAt } = req.body;
    if (!permission || !type) return res.status(400).json({ error: 'permission and type are required.' });

    const { rows: [p] } = await db.query('SELECT id FROM permissions WHERE name=$1', [permission]);
    if (!p) return res.status(404).json({ error: `Permission "${permission}" not found.` });

    const { rows: [ov] } = await db.query(
      `INSERT INTO user_permission_overrides (user_id, permission_id, type, reason, granted_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, permission_id) DO UPDATE
         SET type=$3, reason=$4, granted_by=$5, expires_at=$6, created_at=NOW()
       RETURNING *`,
      [req.params.userId, p.id, type, reason || null, req.user.id, expiresAt || null]
    );
    return res.json(ov);
  } catch (err) { next(err); }
}

async function removeUserOverride(req, res, next) {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM user_permission_overrides WHERE id=$1 AND user_id=$2',
      [req.params.overrideId, req.params.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Override not found.' });
    return res.json({ message: 'Override removed.' });
  } catch (err) { next(err); }
}

// ─── Effective permissions for a user ────────────────────────────────────────
async function getUserEffectivePermissions(req, res, next) {
  try {
    const perms = await computeEffectivePermissions(req.params.userId);
    return res.json({ userId: parseInt(req.params.userId), permissions: perms, count: perms.length });
  } catch (err) { next(err); }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
async function _getInheritanceChain(client, roleId, depth = 0) {
  if (!roleId || depth >= 5) return [];
  const { rows: [r] } = await client.query('SELECT id, inherits_from FROM roles WHERE id=$1', [roleId]);
  if (!r) return [];
  return [r.id, ...(await _getInheritanceChain(client, r.inherits_from, depth + 1))];
}

async function _applyRolePermissions(client, roleId, groups, grants, denies) {
  if (groups !== undefined) {
    await client.query('DELETE FROM role_permission_groups WHERE role_id=$1', [roleId]);
    for (const g of (groups || [])) {
      await client.query(
        `INSERT INTO role_permission_groups (role_id, group_id)
         SELECT $1, id FROM permission_groups WHERE name=$2 OR id=$2::int ON CONFLICT DO NOTHING`,
        [roleId, g]
      );
    }
  }
  if (grants !== undefined) {
    await client.query(`DELETE FROM role_permissions WHERE role_id=$1 AND type='grant'`, [roleId]);
    for (const code of (grants || [])) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, type)
         SELECT $1, id, 'grant' FROM permissions WHERE name=$2 ON CONFLICT DO NOTHING`,
        [roleId, code]
      );
    }
  }
  if (denies !== undefined) {
    await client.query(`DELETE FROM role_permissions WHERE role_id=$1 AND type='deny'`, [roleId]);
    for (const code of (denies || [])) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, type)
         SELECT $1, id, 'deny' FROM permissions WHERE name=$2 ON CONFLICT DO NOTHING`,
        [roleId, code]
      );
    }
  }
}

async function _snapshotRole(client, roleId, version, userId, reason) {
  const { rows: [r] } = await client.query('SELECT * FROM roles WHERE id=$1', [roleId]);
  const { rows: groups } = await client.query(
    `SELECT g.name FROM role_permission_groups rpg JOIN permission_groups g ON g.id=rpg.group_id WHERE rpg.role_id=$1`, [roleId]
  );
  const { rows: perms } = await client.query(
    `SELECT p.name, rp.type FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=$1`, [roleId]
  );
  await client.query(
    `INSERT INTO role_versions (role_id, version, snapshot, changed_by, change_reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [roleId, version, JSON.stringify({ ...r, groups: groups.map(g => g.name), permissions: perms }), userId, reason]
  );
}

module.exports = {
  ensureRbacSchema, computeEffectivePermissions, EFFECTIVE_PERMS_SQL,
  listPermissions, listGroups, createGroup, updateGroup, deleteGroup,
  listRoles, getRole, createRole, updateRole, deleteRole, getRoleHistory,
  getUserOverrides, setUserOverride, removeUserOverride,
  getUserEffectivePermissions,
};
