-- Migration 038: add cancel_reason to gang_requests
ALTER TABLE gang_requests ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(500);
