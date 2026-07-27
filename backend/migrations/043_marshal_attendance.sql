-- Migration 043: Marshal Deployment & Attendance Tracking
-- Tracks scan-marshal gangs (Blue Falcon, White Ox, Red Eagle),
-- their daily shift deployments per area (IMPORTS / EXPORTS / INTRUSIVE),
-- per-marshal attendance, and consecutive-shift overtime.

-- ── Scan-Marshal Gangs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_gangs (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(10)  NOT NULL UNIQUE,
  color      VARCHAR(30)  NOT NULL DEFAULT 'blue',
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Gang Members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_gang_members (
  id          SERIAL       PRIMARY KEY,
  gang_id     INT          NOT NULL REFERENCES scan_gangs(id) ON DELETE CASCADE,
  full_name   VARCHAR(200) NOT NULL,
  employee_id VARCHAR(50)  UNIQUE,
  position_no SMALLINT     NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'marshal'
                CHECK (role IN ('marshal', 'headman', 'foreman')),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (gang_id, position_no)
);

-- ── Shift Deployments (one gang per area per shift per day) ───────────────────
CREATE TABLE IF NOT EXISTS marshal_deployments (
  id              SERIAL      PRIMARY KEY,
  deployment_date DATE        NOT NULL,
  shift           VARCHAR(5)  NOT NULL CHECK (shift IN ('DAY', 'NIGHT')),
  area            VARCHAR(20) NOT NULL CHECK (area IN ('IMPORTS', 'EXPORTS', 'INTRUSIVE')),
  gang_id         INT         NOT NULL REFERENCES scan_gangs(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  opened_by       UUID        REFERENCES users(id),
  closed_by       UUID        REFERENCES users(id),
  closed_at       TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deployment_date, shift, area)
);

CREATE INDEX IF NOT EXISTS idx_marshal_dep_date  ON marshal_deployments(deployment_date);
CREATE INDEX IF NOT EXISTS idx_marshal_dep_shift ON marshal_deployments(deployment_date, shift);

-- ── Per-Marshal Attendance ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marshal_attendance (
  id            SERIAL      PRIMARY KEY,
  deployment_id INT         NOT NULL REFERENCES marshal_deployments(id) ON DELETE CASCADE,
  member_id     INT         NOT NULL REFERENCES scan_gang_members(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'present', 'absent', 'late')),
  marked_at     TIMESTAMPTZ,
  marked_by     UUID        REFERENCES users(id),
  notes         TEXT,
  UNIQUE (deployment_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_marshal_att_dep ON marshal_attendance(deployment_id);

-- ── Consecutive-Shift Overtime Records ───────────────────────────────────────
-- Created when a marshal stays behind after their shift ends to cover another.
CREATE TABLE IF NOT EXISTS marshal_overtime (
  id                 SERIAL      PRIMARY KEY,
  member_id          INT         NOT NULL REFERENCES scan_gang_members(id),
  from_deployment_id INT         NOT NULL REFERENCES marshal_deployments(id),
  to_deployment_id   INT         NOT NULL REFERENCES marshal_deployments(id),
  reason             TEXT,
  recorded_by        UUID        REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, from_deployment_id, to_deployment_id)
);

-- ── Seed gang names and permissions ──────────────────────────────────────────
INSERT INTO scan_gangs (name, code, color) VALUES
  ('Blue Falcon', 'BF', 'blue'),
  ('White Ox',    'WO', 'slate'),
  ('Red Eagle',   'RE', 'red')
ON CONFLICT (name) DO NOTHING;

-- Permissions
INSERT INTO permissions (name, description) VALUES
  ('marshal.view',   'View marshal deployments and attendance'),
  ('marshal.manage', 'Create deployments and record attendance')
ON CONFLICT (name) DO NOTHING;

-- Grant both permissions to admin; grant view+manage to supervisor
DO $$
DECLARE v_admin_id INT; v_sup_id INT;
BEGIN
  SELECT id INTO v_admin_id FROM roles WHERE name='admin';
  SELECT id INTO v_sup_id   FROM roles WHERE name='supervisor';

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_admin_id, id FROM permissions WHERE name IN ('marshal.view','marshal.manage')
  ON CONFLICT DO NOTHING;

  IF v_sup_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_sup_id, id FROM permissions WHERE name IN ('marshal.view','marshal.manage')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
