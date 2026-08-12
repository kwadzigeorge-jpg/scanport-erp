-- Mark truck_allocations that are reefer batches so we can distinguish
-- them from regular single-truck allocations in the bay view.
ALTER TABLE truck_allocations
  ADD COLUMN IF NOT EXISTS is_reefer BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ta_is_reefer ON truck_allocations (is_reefer) WHERE is_reefer = TRUE;
