-- 035_gang_reserve_substitutes.sql
-- Adds reserve gang flag and substitute tracking for absent members

ALTER TABLE gangs ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS gang_allocation_substitutes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id         UUID NOT NULL REFERENCES gang_allocations(id) ON DELETE CASCADE,
  absent_member_id      UUID NOT NULL REFERENCES gang_members(id),
  substitute_member_id  UUID NOT NULL REFERENCES gang_members(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Mark Group A and Group B as reserve pools (handles common naming variants)
UPDATE gangs SET is_reserve = TRUE
WHERE gang_code ILIKE 'group%a'
   OR gang_code ILIKE 'group%b'
   OR gang_code ILIKE 'group-a'
   OR gang_code ILIKE 'group-b'
   OR gang_code ILIKE 'groupa'
   OR gang_code ILIKE 'groupb';
