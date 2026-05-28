-- Add optional second container number for 2×20ft trucks
ALTER TABLE gang_requests
  ADD COLUMN IF NOT EXISTS container_number_2  TEXT,
  ADD COLUMN IF NOT EXISTS is_dual_container    BOOLEAN NOT NULL DEFAULT FALSE;
