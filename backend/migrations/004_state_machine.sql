-- ============================================================
-- MIGRATION 004: Full 7-State Machine + Waybill + Examination
-- ============================================================

-- 1. Add waybill_number (unique agent document reference)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='waybill_number') THEN
    ALTER TABLE container_transactions ADD COLUMN waybill_number VARCHAR(50);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ct_waybill
  ON container_transactions(waybill_number)
  WHERE waybill_number IS NOT NULL;

-- 2. Add examination workflow timestamps
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='arrival_time') THEN
    ALTER TABLE container_transactions ADD COLUMN arrival_time TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='bay_assigned_time') THEN
    ALTER TABLE container_transactions ADD COLUMN bay_assigned_time TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='bay_entry_time') THEN
    ALTER TABLE container_transactions ADD COLUMN bay_entry_time TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examination_start_time') THEN
    ALTER TABLE container_transactions ADD COLUMN examination_start_time TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examination_end_time') THEN
    ALTER TABLE container_transactions ADD COLUMN examination_end_time TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Add examination staff tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examination_started_by') THEN
    ALTER TABLE container_transactions ADD COLUMN examination_started_by UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examination_completed_by') THEN
    ALTER TABLE container_transactions ADD COLUMN examination_completed_by UUID REFERENCES users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='released_by') THEN
    ALTER TABLE container_transactions ADD COLUMN released_by UUID REFERENCES users(id);
  END IF;
END $$;

-- 4. Add examination notes / findings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examination_findings') THEN
    ALTER TABLE container_transactions ADD COLUMN examination_findings TEXT;
  END IF;
END $$;

-- 5. Add examination officer / scanner reference
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='container_transactions' AND column_name='examining_officer') THEN
    ALTER TABLE container_transactions ADD COLUMN examining_officer VARCHAR(150);
  END IF;
END $$;

-- 6. Migrate existing statuses to new state machine values
--    PENDING         → BAY_ASSIGNED   (bay was already assigned when chit was generated)
--    IN_HOLDING_AREA → ARRIVED_AT_BAY (container was confirmed at the bay)
--    Keep: EXITED, CANCELLED
UPDATE container_transactions SET status = 'BAY_ASSIGNED'   WHERE status = 'PENDING';
UPDATE container_transactions SET status = 'ARRIVED_AT_BAY' WHERE status = 'IN_HOLDING_AREA';

-- Backfill timestamp columns from existing data
UPDATE container_transactions
SET arrival_time     = created_at,
    bay_assigned_time = created_at
WHERE status IN ('BAY_ASSIGNED','ARRIVED_AT_BAY','UNDER_EXAMINATION','EXAMINATION_COMPLETED','EXITED');

UPDATE container_transactions
SET bay_entry_time = time_in
WHERE time_in IS NOT NULL;

UPDATE container_transactions
SET examination_start_time = time_in,
    examination_end_time   = time_out
WHERE status = 'EXITED' AND time_in IS NOT NULL;

-- 7. Add new permissions for examination workflow
INSERT INTO permissions (name, description) VALUES
  ('container:start_examination',    'Start container examination'),
  ('container:complete_examination', 'Mark examination as completed'),
  ('container:release',              'Release truck from holding area')
ON CONFLICT (name) DO NOTHING;

-- Grant examination permissions to marshal
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'container:start_examination',
  'container:complete_examination',
  'container:release'
) WHERE r.name = 'marshal'
ON CONFLICT DO NOTHING;

-- Grant to admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN ('container:start_examination','container:complete_examination','container:release')
ON CONFLICT DO NOTHING;

-- Grant to supervisor (can override)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN (
  'container:start_examination',
  'container:complete_examination',
  'container:release'
) WHERE r.name = 'supervisor'
ON CONFLICT DO NOTHING;

-- 8. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_ct_waybill_num   ON container_transactions(waybill_number);
CREATE INDEX IF NOT EXISTS idx_ct_arrival        ON container_transactions(arrival_time);
CREATE INDEX IF NOT EXISTS idx_ct_bay_assigned   ON container_transactions(bay_assigned_time);
CREATE INDEX IF NOT EXISTS idx_ct_exam_start     ON container_transactions(examination_start_time);
