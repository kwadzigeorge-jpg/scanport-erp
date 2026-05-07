-- ============================================================================
-- Migration 008 — Compliance Management Module
-- Covers: Scanner Registry, Certification, Survey Meters, Maintenance,
--         Breakdowns, Corrective Actions, Repairs, Reminders, Annual Reports
-- ============================================================================

-- ── Scanner & Accelerator Registry ───────────────────────────────────────────
CREATE TABLE compliance_scanners (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag                  VARCHAR(50)  UNIQUE,
  scanner_serial             VARCHAR(100) NOT NULL UNIQUE,
  accelerator_serial         VARCHAR(100) UNIQUE,
  manufacturer               VARCHAR(100) NOT NULL,
  model                      VARCHAR(100) NOT NULL,
  type                       VARCHAR(20)  NOT NULL DEFAULT 'fixed'
                               CHECK (type IN ('mobile','fixed','relocatable')),
  location                   VARCHAR(200) NOT NULL,
  location_code              VARCHAR(20),
  operational_status         VARCHAR(30)  NOT NULL DEFAULT 'active'
                               CHECK (operational_status IN ('active','inactive','under_maintenance','decommissioned')),
  date_commissioned          DATE         NOT NULL,
  date_decommissioned        DATE,
  nra_source_registration_no VARCHAR(100),
  radiation_source_activity  VARCHAR(50),
  notes                      TEXT,
  created_by                 UUID REFERENCES users(id),
  updated_by                 UUID REFERENCES users(id),
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Certification Registry ────────────────────────────────────────────────────
CREATE TABLE compliance_certificates (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_id                 UUID         NOT NULL REFERENCES compliance_scanners(id) ON DELETE CASCADE,
  certificate_number         VARCHAR(100),
  certificate_type           VARCHAR(20)  NOT NULL DEFAULT 'renewal'
                               CHECK (certificate_type IN ('initial','renewal','provisional','temporary')),
  certification_status       VARCHAR(30)  NOT NULL DEFAULT 'pending'
                               CHECK (certification_status IN (
                                 'issued','pending','expired','awaiting_inspection',
                                 'application_submitted','application_due','rejected'
                               )),
  last_inspection_date       DATE,
  inspector_name             VARCHAR(200),
  inspector_organisation     VARCHAR(200),
  certificate_issue_date     DATE,
  certificate_expiry_date    DATE,
  application_deadline       DATE,   -- auto-set by trigger: expiry - 4 months
  application_submitted_date DATE,
  application_reference      VARCHAR(100),
  is_current                 BOOLEAN      NOT NULL DEFAULT FALSE,
  document_path              VARCHAR(500),
  document_original_name     VARCHAR(255),
  document_uploaded_at       TIMESTAMPTZ,
  document_uploaded_by       UUID REFERENCES users(id),
  notes                      TEXT,
  created_by                 UUID REFERENCES users(id),
  updated_by                 UUID REFERENCES users(id),
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-calculate application_deadline whenever expiry date is set
CREATE OR REPLACE FUNCTION trg_fn_cert_application_deadline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.certificate_expiry_date IS NOT NULL THEN
    NEW.application_deadline := NEW.certificate_expiry_date - INTERVAL '4 months';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cert_application_deadline
  BEFORE INSERT OR UPDATE ON compliance_certificates
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cert_application_deadline();

-- When a certificate is set as current, clear is_current on others for same scanner
CREATE OR REPLACE FUNCTION trg_fn_cert_set_current()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE compliance_certificates
       SET is_current = FALSE
     WHERE scanner_id = NEW.scanner_id
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cert_set_current
  AFTER INSERT OR UPDATE OF is_current ON compliance_certificates
  FOR EACH ROW
  WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION trg_fn_cert_set_current();

-- ── Survey Meter Registry ─────────────────────────────────────────────────────
CREATE TABLE compliance_survey_meters (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag                    VARCHAR(50)  UNIQUE,
  serial_number                VARCHAR(100) NOT NULL UNIQUE,
  meter_type                   VARCHAR(30)  NOT NULL
                                 CHECK (meter_type IN (
                                   'geiger_muller','ionisation_chamber','scintillation',
                                   'dosimeter','neutron_rem_meter','multi_purpose'
                                 )),
  manufacturer                 VARCHAR(100) NOT NULL,
  model                        VARCHAR(100) NOT NULL,
  assigned_to_scanner_id       UUID REFERENCES compliance_scanners(id) ON DELETE SET NULL,
  location                     VARCHAR(200) NOT NULL,
  operational_status           VARCHAR(30)  NOT NULL DEFAULT 'active'
                                 CHECK (operational_status IN ('active','inactive','under_calibration','decommissioned')),
  last_calibration_date        DATE,
  calibration_expiry_date      DATE,
  calibration_interval_months  INTEGER      NOT NULL DEFAULT 12,
  calibration_lab              VARCHAR(200),
  calibration_certificate_no   VARCHAR(100),
  certificate_path             VARCHAR(500),
  certificate_original_name    VARCHAR(255),
  date_acquired                DATE,
  notes                        TEXT,
  created_by                   UUID REFERENCES users(id),
  updated_by                   UUID REFERENCES users(id),
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Calibration History ───────────────────────────────────────────────────────
CREATE TABLE compliance_calibration_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id                 UUID         NOT NULL REFERENCES compliance_survey_meters(id) ON DELETE CASCADE,
  calibration_date         DATE         NOT NULL,
  calibration_expiry_date  DATE         NOT NULL,
  calibration_lab          VARCHAR(200) NOT NULL,
  certificate_number       VARCHAR(100),
  certificate_path         VARCHAR(500),
  result                   VARCHAR(20)  NOT NULL CHECK (result IN ('pass','fail','conditional_pass')),
  technician               VARCHAR(200),
  notes                    TEXT,
  logged_by                UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- When a calibration record is inserted, update the meter's live calibration fields
CREATE OR REPLACE FUNCTION trg_fn_update_meter_on_calibration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE compliance_survey_meters SET
    last_calibration_date    = NEW.calibration_date,
    calibration_expiry_date  = NEW.calibration_expiry_date,
    calibration_lab          = NEW.calibration_lab,
    calibration_certificate_no = NEW.certificate_number,
    certificate_path         = NEW.certificate_path,
    updated_at               = NOW()
  WHERE id = NEW.meter_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_meter_on_calibration
  AFTER INSERT ON compliance_calibration_records
  FOR EACH ROW EXECUTE FUNCTION trg_fn_update_meter_on_calibration();

-- ── Maintenance Records ───────────────────────────────────────────────────────
CREATE TABLE compliance_maintenance (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_id                  UUID         NOT NULL REFERENCES compliance_scanners(id),
  work_order_id               UUID,        -- future FK to work_orders.id
  maintenance_date            DATE         NOT NULL,
  maintenance_end_date        DATE,
  maintenance_type            VARCHAR(40)  NOT NULL
                                CHECK (maintenance_type IN (
                                  'level_1_routine','level_2_preventive','level_3_major_overhaul',
                                  'calibration','software_update','hardware_inspection'
                                )),
  description                 TEXT         NOT NULL,
  performed_by_type           VARCHAR(30)  NOT NULL
                                CHECK (performed_by_type IN ('oem_vendor','third_party_vendor','internal_technician')),
  performed_by_name           VARCHAR(200) NOT NULL,
  technician_name             VARCHAR(200),
  downtime_start              TIMESTAMPTZ,
  downtime_end                TIMESTAMPTZ,
  downtime_hours              NUMERIC(8,2) GENERATED ALWAYS AS (
                                CASE WHEN downtime_start IS NOT NULL AND downtime_end IS NOT NULL
                                  THEN ROUND(EXTRACT(EPOCH FROM (downtime_end - downtime_start)) / 3600, 2)
                                  ELSE NULL
                                END
                              ) STORED,
  scanner_returned_to_service BOOLEAN      NOT NULL DEFAULT FALSE,
  return_to_service_date      TIMESTAMPTZ,
  next_scheduled_maintenance  DATE,
  cost                        NUMERIC(12,2),
  currency                    VARCHAR(3)   NOT NULL DEFAULT 'GHS',
  procurement_ref             VARCHAR(100),
  notes                       TEXT,
  status                      VARCHAR(20)  NOT NULL DEFAULT 'completed'
                                CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  logged_by                   UUID REFERENCES users(id),
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE compliance_maintenance_attachments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id UUID         NOT NULL REFERENCES compliance_maintenance(id) ON DELETE CASCADE,
  file_path      VARCHAR(500) NOT NULL,
  file_name      VARCHAR(255) NOT NULL,
  file_type      VARCHAR(100),
  description    VARCHAR(200),
  uploaded_by    UUID REFERENCES users(id),
  uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Breakdown Records ─────────────────────────────────────────────────────────
CREATE TABLE compliance_breakdowns (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_id                UUID         NOT NULL REFERENCES compliance_scanners(id),
  breakdown_date            TIMESTAMPTZ  NOT NULL,
  reported_by               UUID         REFERENCES users(id),
  severity                  VARCHAR(10)  NOT NULL CHECK (severity IN ('minor','moderate','major','critical')),
  description_of_failure    TEXT         NOT NULL,
  affected_components       TEXT[],
  root_cause                TEXT,
  root_cause_category       VARCHAR(30)
                              CHECK (root_cause_category IN (
                                'mechanical','electrical','software','radiation_source',
                                'operator_error','environmental','unknown'
                              )),
  immediate_action_taken    TEXT,
  scanner_taken_offline     BOOLEAN      NOT NULL DEFAULT FALSE,
  offline_start             TIMESTAMPTZ,
  return_to_service_date    TIMESTAMPTZ,
  total_downtime_hours      NUMERIC(8,2) GENERATED ALWAYS AS (
                              CASE WHEN offline_start IS NOT NULL AND return_to_service_date IS NOT NULL
                                THEN ROUND(EXTRACT(EPOCH FROM (return_to_service_date - offline_start)) / 3600, 2)
                                ELSE NULL
                              END
                            ) STORED,
  vendor_notified           BOOLEAN      NOT NULL DEFAULT FALSE,
  vendor_name               VARCHAR(200),
  vendor_notified_date      DATE,
  linked_repair_id          UUID,   -- FK added after compliance_repairs is created
  linked_maintenance_id     UUID REFERENCES compliance_maintenance(id),
  nra_notification_required BOOLEAN      NOT NULL DEFAULT FALSE,
  nra_notified_date         DATE,
  nra_reference             VARCHAR(100),
  status                    VARCHAR(25)  NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','under_investigation','repaired','closed','escalated')),
  closed_date               DATE,
  closed_by                 UUID REFERENCES users(id),
  notes                     TEXT,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Corrective Action Records ─────────────────────────────────────────────────
CREATE TABLE compliance_corrective_actions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breakdown_id           UUID REFERENCES compliance_breakdowns(id) ON DELETE SET NULL,
  scanner_id             UUID         NOT NULL REFERENCES compliance_scanners(id),
  action_date            DATE         NOT NULL,
  action_type            VARCHAR(30)  NOT NULL
                           CHECK (action_type IN (
                             'repair','component_replacement','software_patch','recalibration',
                             'procedure_change','training','other'
                           )),
  description            TEXT         NOT NULL,
  performed_by           VARCHAR(200) NOT NULL,
  parts_replaced         JSONB,       -- [{part_number, description, quantity, supplier}]
  effectiveness_verified BOOLEAN      NOT NULL DEFAULT FALSE,
  verified_by            UUID REFERENCES users(id),
  verified_date          DATE,
  preventive_measure     TEXT,
  status                 VARCHAR(20)  NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','in_progress','completed','verified')),
  logged_by              UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Repair Records ────────────────────────────────────────────────────────────
CREATE TABLE compliance_repairs (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_id                   UUID         NOT NULL REFERENCES compliance_scanners(id),
  breakdown_id                 UUID REFERENCES compliance_breakdowns(id) ON DELETE SET NULL,
  maintenance_id               UUID REFERENCES compliance_maintenance(id) ON DELETE SET NULL,
  repair_type                  VARCHAR(20)  NOT NULL
                                 CHECK (repair_type IN ('in_house','vendor_onsite','vendor_depot','oem_factory')),
  repair_date                  DATE         NOT NULL,
  repair_end_date              DATE,
  vendor                       VARCHAR(200),
  vendor_job_number            VARCHAR(100),
  technician                   VARCHAR(200),
  description                  TEXT         NOT NULL,
  components_replaced          JSONB,       -- [{part_number, description, quantity, unit_cost, currency, supplier}]
  labour_hours                 NUMERIC(8,2),
  labour_cost                  NUMERIC(12,2),
  parts_cost                   NUMERIC(12,2),
  total_cost                   NUMERIC(12,2),
  currency                     VARCHAR(3)   NOT NULL DEFAULT 'GHS',
  procurement_ref              VARCHAR(100),
  warranty_claim               BOOLEAN      NOT NULL DEFAULT FALSE,
  warranty_reference           VARCHAR(100),
  scanner_returned_to_service  BOOLEAN      NOT NULL DEFAULT FALSE,
  return_to_service_date       TIMESTAMPTZ,
  quality_check_passed         BOOLEAN,
  quality_check_by             UUID REFERENCES users(id),
  notes                        TEXT,
  logged_by                    UUID REFERENCES users(id),
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Now add the FK back to breakdowns (circular ref resolved after both tables exist)
ALTER TABLE compliance_breakdowns
  ADD CONSTRAINT fk_breakdown_repair
  FOREIGN KEY (linked_repair_id) REFERENCES compliance_repairs(id) ON DELETE SET NULL;

-- ── Reminder Configuration ────────────────────────────────────────────────────
CREATE TABLE compliance_reminder_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          VARCHAR(40)  NOT NULL
                        CHECK (event_type IN (
                          'certificate_expiry','application_deadline','survey_meter_calibration',
                          'scheduled_maintenance','breakdown_overdue','annual_report_due'
                        )),
  days_before         INTEGER      NOT NULL,
  channel             VARCHAR(20)  NOT NULL DEFAULT 'all'
                        CHECK (channel IN ('email','sms','erp_notification','all')),
  recipient_type      VARCHAR(20)  NOT NULL DEFAULT 'compliance_role'
                        CHECK (recipient_type IN ('assigned_user','compliance_role','specific_email','manager')),
  specific_email      VARCHAR(200),
  message_template    TEXT,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  escalate_if_missed  BOOLEAN      NOT NULL DEFAULT FALSE,
  escalation_recipient VARCHAR(200),
  created_by          UUID REFERENCES users(id),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, days_before)
);

-- Seed default reminder intervals
INSERT INTO compliance_reminder_config
  (event_type, days_before, channel, recipient_type, escalate_if_missed)
VALUES
  ('certificate_expiry',       180, 'email',            'compliance_role', FALSE),
  ('certificate_expiry',       120, 'all',              'compliance_role', FALSE),
  ('certificate_expiry',        60, 'all',              'compliance_role', FALSE),
  ('certificate_expiry',        30, 'all',              'compliance_role', TRUE),
  ('certificate_expiry',        14, 'all',              'compliance_role', TRUE),
  ('certificate_expiry',         7, 'all',              'compliance_role', TRUE),
  ('certificate_expiry',         0, 'all',              'manager',         TRUE),
  ('application_deadline',      14, 'all',              'compliance_role', TRUE),
  ('application_deadline',       7, 'all',              'manager',         TRUE),
  ('survey_meter_calibration',  60, 'email',            'compliance_role', FALSE),
  ('survey_meter_calibration',  30, 'all',              'compliance_role', TRUE),
  ('annual_report_due',         90, 'email',            'compliance_role', FALSE),
  ('annual_report_due',         30, 'all',              'manager',         TRUE);

-- ── Reminder Log ──────────────────────────────────────────────────────────────
CREATE TABLE compliance_reminder_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     UUID REFERENCES compliance_reminder_config(id) ON DELETE SET NULL,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     UUID        NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel       VARCHAR(20) NOT NULL,
  recipient     VARCHAR(200),
  message       TEXT,
  status        VARCHAR(10) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error_message TEXT
);

-- ── ERP Internal Notifications ────────────────────────────────────────────────
CREATE TABLE compliance_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  role_target  VARCHAR(50),
  type         VARCHAR(30)  NOT NULL
                 CHECK (type IN (
                   'cert_expiring','cert_expired','calibration_due','application_overdue',
                   'breakdown_open','maintenance_due','report_due','info'
                 )),
  title        VARCHAR(200) NOT NULL,
  body         TEXT         NOT NULL,
  link         VARCHAR(500),
  is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN      NOT NULL DEFAULT FALSE,
  priority     VARCHAR(10)  NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','critical')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Annual NRA Reports ────────────────────────────────────────────────────────
CREATE TABLE compliance_annual_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_year     INTEGER      NOT NULL,
  version         INTEGER      NOT NULL DEFAULT 1,
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','in_review','approved','submitted','acknowledged')),
  report_data     JSONB,       -- frozen snapshot at time of approval
  export_path     VARCHAR(500),
  submitted_date  DATE,
  submitted_by    UUID REFERENCES users(id),
  nra_reference   VARCHAR(100),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (report_year, version)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_compliance_scanners_status   ON compliance_scanners (operational_status);
CREATE INDEX idx_compliance_scanners_location ON compliance_scanners (location_code);

CREATE INDEX idx_compliance_certs_scanner     ON compliance_certificates (scanner_id);
CREATE INDEX idx_compliance_certs_status      ON compliance_certificates (certification_status);
CREATE INDEX idx_compliance_certs_expiry      ON compliance_certificates (certificate_expiry_date);
CREATE INDEX idx_compliance_certs_deadline    ON compliance_certificates (application_deadline);
CREATE INDEX idx_compliance_certs_current     ON compliance_certificates (is_current) WHERE is_current = TRUE;

CREATE INDEX idx_survey_meters_status         ON compliance_survey_meters (operational_status);
CREATE INDEX idx_survey_meters_expiry         ON compliance_survey_meters (calibration_expiry_date);

CREATE INDEX idx_maintenance_scanner          ON compliance_maintenance (scanner_id);
CREATE INDEX idx_maintenance_date             ON compliance_maintenance (maintenance_date);
CREATE INDEX idx_maintenance_status           ON compliance_maintenance (status);

CREATE INDEX idx_breakdowns_scanner           ON compliance_breakdowns (scanner_id);
CREATE INDEX idx_breakdowns_status            ON compliance_breakdowns (status);
CREATE INDEX idx_breakdowns_date              ON compliance_breakdowns (breakdown_date);

CREATE INDEX idx_repairs_scanner              ON compliance_repairs (scanner_id);
CREATE INDEX idx_repairs_date                 ON compliance_repairs (repair_date);

CREATE INDEX idx_notifications_user           ON compliance_notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_role           ON compliance_notifications (role_target, is_read);

-- ── Updated_at auto-update triggers ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_scanners_updated_at   BEFORE UPDATE ON compliance_scanners        FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_maint_updated_at      BEFORE UPDATE ON compliance_maintenance      FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_breakdown_updated_at  BEFORE UPDATE ON compliance_breakdowns       FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_corr_updated_at       BEFORE UPDATE ON compliance_corrective_actions FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_repair_updated_at     BEFORE UPDATE ON compliance_repairs          FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_meter_updated_at      BEFORE UPDATE ON compliance_survey_meters    FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
CREATE TRIGGER trg_report_updated_at     BEFORE UPDATE ON compliance_annual_reports   FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();
