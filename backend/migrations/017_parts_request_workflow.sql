-- ============================================================================
-- Migration 017 — Parts Request Workflow
-- Adds two-step flow: MDE requests → Stores fulfills → optional return
-- ============================================================================

-- 1. Add department column to stores_personnel
ALTER TABLE stores_personnel ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'stores';

-- 2. Classify existing personnel
UPDATE stores_personnel SET department = 'mde'
WHERE LOWER(name) IN ('ahmed tetteh','linus lawson','kwame boateng','emmanuel arko','linda otwe');

UPDATE stores_personnel SET department = 'stores'
WHERE LOWER(name) IN (
  'kwesi ofori boateng','isaac ohene','emmanuel nii adjei','carl selassi tsatsu',
  'george kwadzi','derrick adjei','eric obrey','eric agyekum'
);

-- 3. Add new stores staff
INSERT INTO stores_personnel (name, department, is_active) VALUES
  ('Eric Wiafe', 'stores', TRUE)
ON CONFLICT DO NOTHING;

-- 4. Make location_id nullable (set at fulfillment, not at request time)
ALTER TABLE parts_checkouts ALTER COLUMN location_id DROP NOT NULL;

-- 5. Add new workflow columns
ALTER TABLE parts_checkouts
  ADD COLUMN IF NOT EXISTS requested_by_id  INT         REFERENCES stores_personnel(id),
  ADD COLUMN IF NOT EXISTS fulfilled_by_id  INT         REFERENCES stores_personnel(id),
  ADD COLUMN IF NOT EXISTS requested_at     TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS urgency          VARCHAR(20) DEFAULT 'normal'
    CHECK (urgency IN ('low','normal','urgent'));

-- 6. Extend status to include 'pending'
ALTER TABLE parts_checkouts DROP CONSTRAINT IF EXISTS parts_checkouts_status_check;
ALTER TABLE parts_checkouts ADD CONSTRAINT parts_checkouts_status_check
  CHECK (status IN ('pending','issued','returned','lost'));

-- 7. Index for pending queue lookups
CREATE INDEX IF NOT EXISTS idx_checkouts_pending ON parts_checkouts (status) WHERE status = 'pending';

-- 8. Backfill: set requested_by_id = personnel_id for existing issued records
UPDATE parts_checkouts SET requested_by_id = personnel_id WHERE requested_by_id IS NULL AND personnel_id IS NOT NULL;
