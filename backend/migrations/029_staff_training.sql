-- ─── Staff Training Module ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_types (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(50)  NOT NULL UNIQUE,
  validity_months INT          NOT NULL DEFAULT 12,
  description     TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_training_records (
  id               SERIAL PRIMARY KEY,
  staff_id         INT  NOT NULL REFERENCES lms_staff(id) ON DELETE CASCADE,
  training_type_id INT  NOT NULL REFERENCES training_types(id),
  completion_date  DATE NOT NULL,
  expiry_date      DATE NOT NULL,
  certificate_ref  VARCHAR(200),
  notes            TEXT,
  recorded_by      UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS str_staff_idx  ON staff_training_records(staff_id);
CREATE INDEX IF NOT EXISTS str_type_idx   ON staff_training_records(training_type_id);
CREATE INDEX IF NOT EXISTS str_expiry_idx ON staff_training_records(expiry_date);

-- Only keep the most recent record per staff × training type as "current"
-- (enforced at query time: take MAX completion_date per pair)

-- ─── Seed training types ──────────────────────────────────────────────────────
INSERT INTO training_types (name, code, validity_months, description) VALUES
  ('Radiation Protection and Safety Training', 'RPST',  12, 'Annual mandatory radiation protection and safety training for all scanning staff'),
  ('Smiths Detection Level 1',                 'SDL1',  24, 'Smiths Detection operator training — Level 1 certification'),
  ('Smiths Detection Level 2',                 'SDL2',  24, 'Smiths Detection advanced training — Level 2 certification'),
  ('Bureau Veritas Training',                  'BVT',   24, 'Bureau Veritas compliance and inspection training'),
  ('Fire Safety Training',                     'FST',   12, 'Annual fire safety and evacuation procedures training'),
  ('First Aid Training',                       'FAT',   36, 'First aid and emergency response certification')
ON CONFLICT (code) DO NOTHING;

-- ─── Permissions ─────────────────────────────────────────────────────────────
INSERT INTO permissions (name, description)
VALUES
  ('training.view',   'View staff training records and status'),
  ('training.manage', 'Add, edit and delete training records')
ON CONFLICT (name) DO NOTHING;

-- Grant training.view and training.manage to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name IN ('training.view','training.manage')
ON CONFLICT DO NOTHING;

-- Grant training.view to supervisor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'supervisor'
  AND p.name = 'training.view'
ON CONFLICT DO NOTHING;
