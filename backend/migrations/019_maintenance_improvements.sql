-- Migration 019: Maintenance improvements
-- Parts used per maintenance job, sign-off fields, attachment columns

-- Parts consumed per maintenance record
CREATE TABLE IF NOT EXISTS compliance_maintenance_parts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id   UUID         NOT NULL REFERENCES compliance_maintenance(id) ON DELETE CASCADE,
  part_id          INT          REFERENCES spare_parts(id),
  part_number      VARCHAR(100),
  part_description TEXT         NOT NULL,
  quantity         NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit_cost        NUMERIC(12,2),
  total_cost       NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  added_by         UUID         REFERENCES users(id),
  added_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sign-off and completion fields on maintenance records
ALTER TABLE compliance_maintenance
  ADD COLUMN IF NOT EXISTS signed_off_by    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS signed_off_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Attachment columns (single primary doc per record — full attachments via compliance_maintenance_attachments)
ALTER TABLE compliance_maintenance
  ADD COLUMN IF NOT EXISTS document_path          VARCHAR(500),
  ADD COLUMN IF NOT EXISTS document_original_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_uploaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_uploaded_by   UUID REFERENCES users(id);
