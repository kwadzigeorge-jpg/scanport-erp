-- 037_grievance_statements.sql
-- Statement-taking platform for grievance investigations

CREATE TABLE IF NOT EXISTS grievance_statements (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id      UUID         NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  statement_type    VARCHAR(20)  NOT NULL DEFAULT 'witness'
                      CHECK (statement_type IN ('complainant','respondent','witness','other')),
  staff_name        VARCHAR(200) NOT NULL,
  staff_designation VARCHAR(100),
  department        VARCHAR(100),
  statement_text    TEXT,
  token             UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_submitted      BOOLEAN      NOT NULL DEFAULT FALSE,
  submitted_at      TIMESTAMPTZ,
  due_date          DATE,
  requested_by      UUID         REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grievance_statements_grievance ON grievance_statements(grievance_id);
CREATE INDEX IF NOT EXISTS idx_grievance_statements_token     ON grievance_statements(token);
