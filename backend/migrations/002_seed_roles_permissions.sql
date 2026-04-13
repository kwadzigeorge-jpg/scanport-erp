-- ============================================================
-- SEED ROLES & PERMISSIONS
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('admin',         'Full system control – manage users, roles, config'),
  ('supervisor',    'Full dashboard visibility, can override transactions'),
  ('booth_officer', 'Creates allocations and generates chits'),
  ('marshal',       'Confirms container entry and exit at gate')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) VALUES
  -- Container operations
  ('container:allocate',       'Create a holding area allocation'),
  ('container:generate_chit',  'Generate and print a chit'),
  ('container:confirm_entry',  'Confirm container entry into holding area'),
  ('container:confirm_exit',   'Confirm container exit from holding area'),
  ('container:view',           'View container transactions'),
  ('container:override',       'Override or correct a transaction'),
  ('container:cancel',         'Cancel a transaction'),
  -- Dashboard
  ('dashboard:view',           'View real-time dashboard'),
  ('dashboard:view_active_users', 'See who is currently logged in'),
  -- Reports
  ('reports:view',             'View and export reports'),
  ('reports:export',           'Export reports to CSV/Excel'),
  -- User management
  ('users:view',               'View user list'),
  ('users:create',             'Create a new user'),
  ('users:edit',               'Edit a user'),
  ('users:deactivate',         'Deactivate a user'),
  -- System config
  ('config:view',              'View system configuration'),
  ('config:edit',              'Edit system configuration'),
  -- Audit
  ('audit:view',               'View audit logs')
ON CONFLICT (name) DO NOTHING;

-- Admin – all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Supervisor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'container:view', 'container:override', 'container:cancel',
  'dashboard:view', 'dashboard:view_active_users',
  'reports:view', 'reports:export',
  'users:view', 'audit:view', 'config:view'
) WHERE r.name = 'supervisor'
ON CONFLICT DO NOTHING;

-- Booth Officer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'container:allocate', 'container:generate_chit', 'container:view',
  'dashboard:view'
) WHERE r.name = 'booth_officer'
ON CONFLICT DO NOTHING;

-- Marshal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'container:confirm_entry', 'container:confirm_exit', 'container:view',
  'dashboard:view'
) WHERE r.name = 'marshal'
ON CONFLICT DO NOTHING;

-- Default holding areas
INSERT INTO holding_areas (name, code, description) VALUES
  ('Holding Area Alpha', 'HA-A', 'Primary holding zone – North side'),
  ('Holding Area Bravo', 'HA-B', 'Secondary holding zone – South side')
ON CONFLICT (code) DO NOTHING;

-- Default bays for each area
INSERT INTO bays (holding_area_id, bay_code, capacity)
SELECT ha.id, 'BAY-' || LPAD(n::TEXT, 2, '0'), 1
FROM holding_areas ha
CROSS JOIN generate_series(1, 10) n
WHERE ha.code = 'HA-A'
ON CONFLICT DO NOTHING;

INSERT INTO bays (holding_area_id, bay_code, capacity)
SELECT ha.id, 'BAY-' || LPAD(n::TEXT, 2, '0'), 1
FROM holding_areas ha
CROSS JOIN generate_series(1, 10) n
WHERE ha.code = 'HA-B'
ON CONFLICT DO NOTHING;

-- Default system config
INSERT INTO system_config (key, value, description) VALUES
  ('overstay_threshold_hours',  '3',    'Hours before a container is flagged as overstayed'),
  ('session_inactivity_minutes','30',   'Auto-logout after N minutes of inactivity'),
  ('prevent_concurrent_sessions','true','Block multiple simultaneous logins per user'),
  ('max_failed_logins',         '5',    'Lock account after N failed attempts'),
  ('lockout_minutes',           '15',   'Account lockout duration in minutes')
ON CONFLICT (key) DO NOTHING;
