-- Migration 029: Gang substitutions
-- Tracks when a reserve member fills in for an absent gang member

CREATE TABLE IF NOT EXISTS gang_substitutions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  gang_id          UUID         NOT NULL REFERENCES gangs(id),
  absent_member_id UUID         NOT NULL REFERENCES gang_members(id),
  substitute_id    UUID         NOT NULL REFERENCES gang_members(id),
  reason           VARCHAR(80),
  notes            TEXT,
  created_by       UUID         NOT NULL REFERENCES users(id),
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gang_subs_gang       ON gang_substitutions(gang_id);
CREATE INDEX IF NOT EXISTS idx_gang_subs_active     ON gang_substitutions(gang_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gang_subs_absent     ON gang_substitutions(absent_member_id);
CREATE INDEX IF NOT EXISTS idx_gang_subs_substitute ON gang_substitutions(substitute_id);
