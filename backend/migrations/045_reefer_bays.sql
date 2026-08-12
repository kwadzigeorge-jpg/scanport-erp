-- Add is_reefer flag to bays table
-- Reefer bays are reserved for refrigerated containers and must not
-- be mixed with regular holding-area allocations.

ALTER TABLE bays
  ADD COLUMN IF NOT EXISTS is_reefer BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to speed up allocation queries that filter on is_reefer
CREATE INDEX IF NOT EXISTS idx_bays_is_reefer ON bays (is_reefer) WHERE is_active = TRUE;
