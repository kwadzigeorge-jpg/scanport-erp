-- Migration 039: add overall satisfaction rating to service_feedback
ALTER TABLE service_feedback
  ADD COLUMN IF NOT EXISTS overall_rating SMALLINT CHECK (overall_rating BETWEEN 1 AND 5);
