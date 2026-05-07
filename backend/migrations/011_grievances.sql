-- ============================================================================
-- Migration 011 — Grievance Registry
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS grievance_ref_seq START 1;

CREATE TABLE grievances (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              VARCHAR(20)  UNIQUE,
  is_anonymous     BOOLEAN      NOT NULL DEFAULT FALSE,
  employee_name    VARCHAR(200) NOT NULL,
  department       VARCHAR(100) NOT NULL,
  grievance_type   VARCHAR(60)  NOT NULL
                   CHECK (grievance_type IN (
                     'harassment','interpersonal_conflict','pay_dispute',
                     'workload_unfair_assignment','management_conduct',
                     'unsafe_working_conditions','discrimination','other'
                   )),
  status           VARCHAR(30)  NOT NULL DEFAULT 'open'
                   CHECK (status IN (
                     'open','under_investigation','escalated',
                     'resolved','withdrawn','closed'
                   )),
  priority         VARCHAR(10)  NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  description      TEXT         NOT NULL,
  date_raised      DATE         NOT NULL DEFAULT CURRENT_DATE,
  assigned_to_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR(200),
  resolved_date    DATE,
  resolution_notes TEXT,
  withdrawn_date   DATE,
  withdrawn_reason TEXT,
  escalated_date   DATE,
  escalated_reason TEXT,
  is_overdue       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by       UUID         REFERENCES users(id),
  updated_by       UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-generate REF (GRV-YYYY-NNNN, per-year counter)
CREATE OR REPLACE FUNCTION trg_fn_grievance_before()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT;
  v_seq  INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_year := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(ref FROM 10) AS INTEGER)
    ), 0) + 1
    INTO v_seq
    FROM grievances
    WHERE ref LIKE 'GRV-' || v_year || '-%';
    NEW.ref := 'GRV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grievance_before
  BEFORE INSERT OR UPDATE ON grievances
  FOR EACH ROW EXECUTE FUNCTION trg_fn_grievance_before();

-- Activity / case timeline
CREATE TABLE grievance_activities (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id  UUID         NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  activity_type VARCHAR(30)  NOT NULL
                CHECK (activity_type IN (
                  'created','status_change','note','assignment','resolution','withdrawal'
                )),
  note          TEXT,
  old_status    VARCHAR(30),
  new_status    VARCHAR(30),
  created_by    UUID         REFERENCES users(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON grievances(status);
CREATE INDEX ON grievances(department);
CREATE INDEX ON grievances(date_raised);
CREATE INDEX ON grievances(is_overdue);
CREATE INDEX ON grievance_activities(grievance_id);
