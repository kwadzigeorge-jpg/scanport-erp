-- ============================================================================
-- Migration 015 — Parts Checkout (officer accountability tracking)
-- ============================================================================

CREATE TABLE parts_checkouts (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                 VARCHAR(20)  NOT NULL UNIQUE,

  -- What was taken
  part_id             INT          NOT NULL REFERENCES spare_parts(id),
  location_id         INT          NOT NULL REFERENCES storage_locations(id),
  qty                 NUMERIC(12,4) NOT NULL CHECK (qty > 0),

  -- Who took it (personnel_id added by migration 016)
  officer_id          UUID         REFERENCES users(id),
  officer_name        VARCHAR(200) NOT NULL,

  -- When / why
  checked_out_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expected_return_at  DATE,
  work_order          VARCHAR(100),
  purpose             TEXT,

  -- Stock ledger reference for the STOCK_OUT
  txn_ref             VARCHAR(30),

  -- Return
  returned_at         TIMESTAMPTZ,
  return_condition    VARCHAR(20)  CHECK (return_condition IN ('good','damaged','partial','lost')),
  qty_returned        NUMERIC(12,4),
  return_notes        TEXT,
  return_txn_ref      VARCHAR(30),

  -- Status
  status              VARCHAR(20)  NOT NULL DEFAULT 'issued'
                        CHECK (status IN ('issued','returned','lost')),

  -- Meta
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sequential ref: CHK-YYYY-NNNN
CREATE OR REPLACE FUNCTION trg_fn_checkout_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE yr TEXT := EXTRACT(YEAR FROM NOW())::TEXT; cnt INT;
BEGIN
  SELECT COUNT(*) + 1 INTO cnt
  FROM parts_checkouts WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.ref := 'CHK-' || yr || '-' || LPAD(cnt::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkout_ref
  BEFORE INSERT ON parts_checkouts
  FOR EACH ROW EXECUTE FUNCTION trg_fn_checkout_ref();

CREATE TRIGGER trg_checkout_updated_at
  BEFORE UPDATE ON parts_checkouts
  FOR EACH ROW EXECUTE FUNCTION trg_fn_set_updated_at();

CREATE INDEX idx_checkouts_officer ON parts_checkouts (officer_id);
CREATE INDEX idx_checkouts_part    ON parts_checkouts (part_id);
CREATE INDEX idx_checkouts_status  ON parts_checkouts (status);
CREATE INDEX idx_checkouts_created ON parts_checkouts (created_at DESC);

-- Permissions
INSERT INTO permissions (name, description) VALUES
  ('stock.checkout', 'Issue and return parts to maintenance officers')
ON CONFLICT (name) DO NOTHING;
