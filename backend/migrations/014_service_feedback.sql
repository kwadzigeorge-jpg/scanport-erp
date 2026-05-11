-- ============================================================================
-- Migration 014 — Stakeholder Service Feedback
-- ============================================================================

CREATE TABLE service_feedback (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               VARCHAR(20)  NOT NULL UNIQUE,

  -- Submitter
  is_anonymous      BOOLEAN      NOT NULL DEFAULT FALSE,
  submitter_name    VARCHAR(200) NOT NULL,
  submitter_email   VARCHAR(200),
  submitter_phone   VARCHAR(50),
  submitter_type    VARCHAR(50)  NOT NULL DEFAULT 'other'
                      CHECK (submitter_type IN (
                        'shipping_agent','importer','exporter',
                        'truck_operator','customs_broker','port_authority','other'
                      )),
  company_name      VARCHAR(200),

  -- Issue
  category          VARCHAR(50)  NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'wait_time','staff_conduct','facility','documentation',
                        'communication','billing','safety','other'
                      )),
  priority          VARCHAR(10)  NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low','normal','high','urgent')),
  subject           VARCHAR(300) NOT NULL,
  description       TEXT         NOT NULL,
  date_occurred     DATE,

  -- Management
  status            VARCHAR(30)  NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','acknowledged','under_review','resolved','closed')),
  assigned_to_name  VARCHAR(200),
  resolution_notes  TEXT,
  resolved_date     DATE,

  -- Meta
  source_ip         INET,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id)
);

-- Per-year sequential ref (SFB-YYYY-NNNN)
CREATE OR REPLACE FUNCTION trg_fn_feedback_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE yr TEXT := EXTRACT(YEAR FROM NOW())::TEXT; cnt INT;
BEGIN
  SELECT COUNT(*) + 1 INTO cnt
  FROM service_feedback WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.ref := 'SFB-' || yr || '-' || LPAD(cnt::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_ref
  BEFORE INSERT ON service_feedback
  FOR EACH ROW EXECUTE FUNCTION trg_fn_feedback_ref();

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON service_feedback
  FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();

-- Activity log
CREATE TABLE service_feedback_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   UUID        NOT NULL REFERENCES service_feedback(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('created','status_change','note','assigned')),
  old_status    VARCHAR(30),
  new_status    VARCHAR(30),
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_status   ON service_feedback (status);
CREATE INDEX idx_feedback_category ON service_feedback (category);
CREATE INDEX idx_feedback_created  ON service_feedback (created_at DESC);
CREATE INDEX idx_feedback_acts     ON service_feedback_activities (feedback_id, created_at);

-- Permissions
INSERT INTO permissions (name, description) VALUES
  ('feedback.view',   'View stakeholder service feedback submissions'),
  ('feedback.manage', 'Update status and manage feedback cases'),
  ('feedback.export', 'Export feedback registry to XLSX')
ON CONFLICT (name) DO NOTHING;
