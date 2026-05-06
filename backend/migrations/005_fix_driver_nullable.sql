-- ============================================================
-- MIGRATION 005: Make driver_name / driver_phone nullable
-- Driver details are optional at the booth — NOT NULL was wrong.
-- ============================================================

ALTER TABLE truck_allocations
  ALTER COLUMN driver_name  DROP NOT NULL,
  ALTER COLUMN driver_phone DROP NOT NULL;
