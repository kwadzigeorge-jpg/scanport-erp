-- Add individual availability status to gang members
ALTER TABLE gang_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_break', 'off_duty', 'sick', 'on_leave'));
