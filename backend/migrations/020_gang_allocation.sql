-- Migration 020: Gang Allocation & Performance Management System
-- Manages gangs (4 dockers + 1 cutter), agent requests, job allocations,
-- execution tracking, and performance analytics.

-- ── Gangs ─────────────────────────────────────────────────────────────────────
CREATE TABLE gangs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  gang_code             VARCHAR(20)  NOT NULL UNIQUE,
  status                VARCHAR(15)  NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available','busy','on_break','off_duty')),
  specialization        VARCHAR(100),
  performance_score     NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  total_jobs_completed  INT          NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_by            UUID         REFERENCES users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Gang Members (dockers + cutter) ──────────────────────────────────────────
CREATE TABLE gang_members (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  gang_id      UUID         NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  role         VARCHAR(10)  NOT NULL CHECK (role IN ('cutter','docker')),
  full_name    VARCHAR(200) NOT NULL,
  employee_id  VARCHAR(50)  NOT NULL UNIQUE,
  phone        VARCHAR(20),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  joined_date  DATE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Agent Requests (container examination jobs) ───────────────────────────────
CREATE TABLE gang_requests (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ref      VARCHAR(30)  NOT NULL UNIQUE,
  agent_name       VARCHAR(200) NOT NULL,
  agent_phone      VARCHAR(20),
  agency           VARCHAR(200),
  bay_number       VARCHAR(20)  NOT NULL,
  container_number VARCHAR(20)  NOT NULL,
  cargo_type       VARCHAR(100),
  priority         VARCHAR(10)  NOT NULL DEFAULT 'normal'
                     CHECK (priority IN ('normal','urgent')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','allocated','in_progress','completed','cancelled')),
  notes            TEXT,
  received_by      UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Gang Job Allocations ──────────────────────────────────────────────────────
CREATE TABLE gang_allocations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id                UUID        NOT NULL REFERENCES gang_requests(id),
  gang_id                   UUID        NOT NULL REFERENCES gangs(id),
  allocated_by              UUID        NOT NULL REFERENCES users(id),
  is_override               BOOLEAN     NOT NULL DEFAULT FALSE,
  override_reason           TEXT,
  engine_recommended_gang   UUID        REFERENCES gangs(id),
  engine_score              NUMERIC(6,2),
  expected_start            TIMESTAMPTZ,
  expected_duration_minutes INT         NOT NULL DEFAULT 60,
  -- Lifecycle timestamps
  allocated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gang_arrived_at           TIMESTAMPTZ,
  work_started_at           TIMESTAMPTZ,
  work_completed_at         TIMESTAMPTZ,
  -- Duration (computed in queries)
  status                    VARCHAR(20) NOT NULL DEFAULT 'allocated'
                              CHECK (status IN ('allocated','gang_dispatched','in_progress','completed','cancelled')),
  supervisor_comments       TEXT,
  agent_rating              SMALLINT    CHECK (agent_rating BETWEEN 1 AND 5),
  agent_feedback            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Delay Logs ────────────────────────────────────────────────────────────────
CREATE TABLE gang_delay_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id   UUID        NOT NULL REFERENCES gang_allocations(id) ON DELETE CASCADE,
  delay_type      VARCHAR(30) NOT NULL
                    CHECK (delay_type IN (
                      'late_arrival','equipment_issue','bay_occupied',
                      'safety_concern','crane_unavailable','container_inaccessible',
                      'documentation','other'
                    )),
  delay_minutes   INT,
  description     TEXT        NOT NULL,
  reported_by     UUID        REFERENCES users(id),
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Performance Records (one per completed job) ───────────────────────────────
CREATE TABLE gang_performance_records (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gang_id                   UUID        NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  allocation_id             UUID        UNIQUE REFERENCES gang_allocations(id) ON DELETE CASCADE,
  period_date               DATE        NOT NULL,
  actual_duration_minutes   INT,
  expected_duration_minutes INT,
  delay_count               INT         NOT NULL DEFAULT 0,
  agent_rating              SMALLINT,
  arrived_on_time           BOOLEAN,
  duration_score            NUMERIC(5,2),
  delay_score               NUMERIC(5,2),
  arrival_score             NUMERIC(5,2),
  rating_score              NUMERIC(5,2),
  total_score               NUMERIC(5,2),
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── System Notifications ──────────────────────────────────────────────────────
CREATE TABLE gang_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(30) NOT NULL
                    CHECK (type IN (
                      'late_arrival','job_overdue','idle_gang',
                      'pending_request','safety_alert','job_assigned'
                    )),
  message         TEXT        NOT NULL,
  allocation_id   UUID        REFERENCES gang_allocations(id) ON DELETE CASCADE,
  gang_id         UUID        REFERENCES gangs(id) ON DELETE CASCADE,
  is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_gang_requests_status     ON gang_requests(status);
CREATE INDEX idx_gang_requests_created    ON gang_requests(created_at DESC);
CREATE INDEX idx_gang_alloc_gang          ON gang_allocations(gang_id);
CREATE INDEX idx_gang_alloc_request       ON gang_allocations(request_id);
CREATE INDEX idx_gang_alloc_status        ON gang_allocations(status);
CREATE INDEX idx_gang_alloc_date          ON gang_allocations(allocated_at DESC);
CREATE INDEX idx_gang_perf_gang_date      ON gang_performance_records(gang_id, period_date DESC);
CREATE INDEX idx_gang_members_gang        ON gang_members(gang_id);
CREATE INDEX idx_gang_notif_unread        ON gang_notifications(is_read) WHERE is_read = FALSE;
