-- Migration 040: Integrity / Anti-Corruption Reports
-- Customers report bay solicitation, bribery demands, or witnessed corruption

CREATE TABLE integrity_reports (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                VARCHAR(20)  NOT NULL UNIQUE,

  -- What happened
  incident_type      VARCHAR(50)  NOT NULL DEFAULT 'bay_solicitation'
                       CHECK (incident_type IN (
                         'bay_solicitation', 'payment_demand', 'bribe_accepted',
                         'preferential_treatment', 'witness_only', 'other'
                       )),
  incident_date      DATE,
  bay_number         VARCHAR(20),
  amount_mentioned   VARCHAR(100),   -- e.g. "GHS 500", "USD 50", "I don't know"

  -- What happened in their own words
  description        TEXT         NOT NULL,
  staff_description  VARCHAR(500), -- physical / role / location description, no name required

  -- Reporter details (all optional — truly anonymous by default)
  was_directly_affected BOOLEAN   NOT NULL DEFAULT FALSE,
  reporter_contact   VARCHAR(300), -- email or phone for voluntary follow-up
  company_name       VARCHAR(200),

  -- Case management (admin only)
  status             VARCHAR(30)  NOT NULL DEFAULT 'new'
                       CHECK (status IN (
                         'new', 'under_investigation', 'substantiated',
                         'unsubstantiated', 'closed'
                       )),
  assigned_to        VARCHAR(200),
  investigation_notes TEXT,
  closed_date        DATE,

  -- Meta (no source_ip — truly anonymous)
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_by        UUID REFERENCES users(id)
);

-- Auto-generate ref: INT-YYYY-NNNN
CREATE OR REPLACE FUNCTION trg_fn_integrity_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE yr TEXT := EXTRACT(YEAR FROM NOW())::TEXT; cnt INT;
BEGIN
  SELECT COUNT(*) + 1 INTO cnt
  FROM integrity_reports WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.ref := 'INT-' || yr || '-' || LPAD(cnt::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_integrity_ref
  BEFORE INSERT ON integrity_reports
  FOR EACH ROW EXECUTE FUNCTION trg_fn_integrity_ref();

CREATE TRIGGER trg_integrity_updated_at
  BEFORE UPDATE ON integrity_reports
  FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();

-- Activity log for investigation trail
CREATE TABLE integrity_report_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID        NOT NULL REFERENCES integrity_reports(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('created','status_change','note','assigned')),
  old_status    VARCHAR(30),
  new_status    VARCHAR(30),
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrity_status     ON integrity_reports (status);
CREATE INDEX idx_integrity_created    ON integrity_reports (created_at DESC);
CREATE INDEX idx_integrity_type       ON integrity_reports (incident_type);
CREATE INDEX idx_integrity_acts       ON integrity_report_activities (report_id, created_at);

-- Permissions (admin-only)
INSERT INTO permissions (name, description) VALUES
  ('integrity.view',   'View integrity and anti-corruption reports — restricted to senior management'),
  ('integrity.manage', 'Manage integrity reports: update status, add investigation notes')
ON CONFLICT (name) DO NOTHING;
