-- ============================================================================
-- Migration 016 — Stores Personnel registry + parts_checkouts update
-- ============================================================================

-- Named personnel who have access to the stores
CREATE TABLE stores_personnel (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  department  VARCHAR(100),
  notes       TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO stores_personnel (name, department) VALUES
  ('Kwesi Ofori Boateng',  'Maintenance'),
  ('Emmanuel Nii Adjei',   'Maintenance'),
  ('Carl Selassi Tsatsu',  'Maintenance'),
  ('Isaac Ohene',          'Maintenance'),
  ('Linda Otwe',           'Maintenance'),
  ('Eric Obrey',           'Stores'),
  ('Eric Agyekum',         'Stores'),
  ('Derrick Adjei',        'Stores'),
  ('George Kwadzi',        'Stores'),
  ('Ahmed Tetteh',         'Stores'),
  ('Linus Lawson',         'Stores'),
  ('Kwame Boateng',        'Stores'),
  ('Emmanuel Arko',        'Stores');

-- Link parts_checkouts to stores_personnel, remove forced FK to users
ALTER TABLE parts_checkouts
  DROP CONSTRAINT IF EXISTS parts_checkouts_officer_id_fkey,
  ALTER COLUMN officer_id DROP NOT NULL,
  ADD COLUMN  personnel_id INT REFERENCES stores_personnel(id);

-- Back-fill any existing rows' personnel_id via officer_name match (no-op on fresh installs)
UPDATE parts_checkouts pc
SET personnel_id = sp.id
FROM stores_personnel sp
WHERE LOWER(pc.officer_name) = LOWER(sp.name) AND pc.personnel_id IS NULL;

-- Rename status 'active' to 'issued' for clarity (consumable parts have no expected return)
ALTER TABLE parts_checkouts
  DROP CONSTRAINT IF EXISTS parts_checkouts_status_check;

ALTER TABLE parts_checkouts
  ADD CONSTRAINT parts_checkouts_status_check
    CHECK (status IN ('issued','returned','lost'));

UPDATE parts_checkouts SET status = 'issued' WHERE status = 'active';

ALTER TABLE parts_checkouts ALTER COLUMN status SET DEFAULT 'issued';

-- expected_return_at is now optional and only relevant for borrowed tools, not consumables
-- No schema change needed — column already nullable.
