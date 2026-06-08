-- ============================================================================
-- Migration 012 — Grievance Config (dynamic departments & types)
-- ============================================================================

-- Remove the hardcoded CHECK so custom types are allowed
ALTER TABLE grievances DROP CONSTRAINT IF EXISTS grievances_grievance_type_check;

CREATE TABLE grievance_config (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type VARCHAR(20)  NOT NULL CHECK (config_type IN ('department','grievance_type')),
  value       VARCHAR(100) NOT NULL,
  label       VARCHAR(200) NOT NULL,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (config_type, value)
);

CREATE INDEX ON grievance_config(config_type, is_active);

-- ── Seed departments ──────────────────────────────────────────────────────────
INSERT INTO grievance_config (config_type, value, label, sort_order) VALUES
  ('department', 'Security',            'Security',            1),
  ('department', 'Customs Liaison',     'Customs Liaison',     2),
  ('department', 'Administration',      'Administration',      3),
  ('department', 'Maintenance',         'Maintenance',         4),
  ('department', 'Scanning Operations', 'Scanning Operations', 5),
  ('department', 'Post-Scanning',       'Post-Scanning',       6),
  ('department', 'Finance',             'Finance',             7),
  ('department', 'HR',                  'HR',                  8),
  ('department', 'IT',                  'IT',                  9)
ON CONFLICT DO NOTHING;

-- ── Seed grievance types (matching existing hardcoded values) ─────────────────
INSERT INTO grievance_config (config_type, value, label, sort_order) VALUES
  ('grievance_type', 'harassment',                 'Harassment',                  1),
  ('grievance_type', 'interpersonal_conflict',     'Interpersonal Conflict',       2),
  ('grievance_type', 'pay_dispute',                'Pay Dispute',                  3),
  ('grievance_type', 'workload_unfair_assignment', 'Workload / Unfair Assignment', 4),
  ('grievance_type', 'management_conduct',         'Management Conduct',           5),
  ('grievance_type', 'unsafe_working_conditions',  'Unsafe Working Conditions',    6),
  ('grievance_type', 'discrimination',             'Discrimination',               7),
  ('grievance_type', 'other',                      'Other',                        8)
ON CONFLICT DO NOTHING;
