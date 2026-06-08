-- ── Migration 006: Spare Parts Inventory Management ─────────────────────────

-- Part categories (hierarchical)
CREATE TABLE IF NOT EXISTS part_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  parent_id  INT REFERENCES part_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage locations (warehouse / shelf / bin)
CREATE TABLE IF NOT EXISTS storage_locations (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,
  warehouse   VARCHAR(100) NOT NULL,
  shelf       VARCHAR(50),
  bin         VARCHAR(50),
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment master
CREATE TABLE IF NOT EXISTS equipment (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50)  NOT NULL UNIQUE,
  name            VARCHAR(150) NOT NULL,
  category        VARCHAR(100),
  manufacturer    VARCHAR(100),
  model           VARCHAR(100),
  serial_number   VARCHAR(100),
  location        VARCHAR(150),
  commissioned_at DATE,
  mtbf_hours      NUMERIC(10,2),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50)  NOT NULL UNIQUE,
  name           VARCHAR(200) NOT NULL,
  contact_name   VARCHAR(150),
  email          VARCHAR(200),
  phone          VARCHAR(50),
  address        TEXT,
  lead_time_days INT     DEFAULT 7,
  rating         NUMERIC(3,2) DEFAULT 5.0,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Spare parts master
CREATE TABLE IF NOT EXISTS spare_parts (
  id                  SERIAL PRIMARY KEY,
  part_number         VARCHAR(100) NOT NULL UNIQUE,
  description         TEXT         NOT NULL,
  category_id         INT REFERENCES part_categories(id) ON DELETE SET NULL,
  manufacturer        VARCHAR(150),
  primary_supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_of_measure     VARCHAR(30)  NOT NULL DEFAULT 'EA',
  criticality         VARCHAR(20)  NOT NULL DEFAULT 'NON_CRITICAL'
                        CHECK (criticality IN ('CRITICAL','IMPORTANT','NON_CRITICAL')),
  valuation_method    VARCHAR(10)  NOT NULL DEFAULT 'WAVG'
                        CHECK (valuation_method IN ('FIFO','WAVG')),
  unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency            VARCHAR(3)   NOT NULL DEFAULT 'GHS',
  min_stock_level     NUMERIC(12,4) NOT NULL DEFAULT 0,
  max_stock_level     NUMERIC(12,4) NOT NULL DEFAULT 0,
  reorder_point       NUMERIC(12,4) NOT NULL DEFAULT 0,
  reorder_qty         NUMERIC(12,4) NOT NULL DEFAULT 0,
  lead_time_days      INT          NOT NULL DEFAULT 7,
  safety_stock        NUMERIC(12,4) NOT NULL DEFAULT 0,
  default_location_id INT REFERENCES storage_locations(id) ON DELETE SET NULL,
  has_expiry          BOOLEAN DEFAULT FALSE,
  has_serial          BOOLEAN DEFAULT FALSE,
  image_url           TEXT,
  notes               TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','OBSOLETE','DISCONTINUED')),
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Part ↔ Equipment mapping
CREATE TABLE IF NOT EXISTS part_equipment_map (
  part_id      INT NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  equipment_id INT NOT NULL REFERENCES equipment(id)   ON DELETE CASCADE,
  qty_per_unit NUMERIC(10,4) DEFAULT 1,
  PRIMARY KEY (part_id, equipment_id)
);

-- Part ↔ Supplier (multiple suppliers per part)
CREATE TABLE IF NOT EXISTS part_suppliers (
  id               SERIAL PRIMARY KEY,
  part_id          INT NOT NULL REFERENCES spare_parts(id)  ON DELETE CASCADE,
  supplier_id      INT NOT NULL REFERENCES suppliers(id)    ON DELETE CASCADE,
  supplier_part_no VARCHAR(100),
  unit_cost        NUMERIC(14,4),
  lead_time_days   INT DEFAULT 7,
  is_preferred     BOOLEAN DEFAULT FALSE,
  UNIQUE (part_id, supplier_id)
);

-- Stock ledger (immutable — corrections via ADJUSTMENT only)
CREATE TABLE IF NOT EXISTS stock_ledger (
  id            BIGSERIAL PRIMARY KEY,
  part_id       INT         NOT NULL REFERENCES spare_parts(id),
  location_id   INT         NOT NULL REFERENCES storage_locations(id),
  txn_type      VARCHAR(20) NOT NULL
                  CHECK (txn_type IN (
                    'STOCK_IN','STOCK_OUT','RETURN',
                    'ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT'
                  )),
  txn_ref       VARCHAR(100) NOT NULL,
  qty           NUMERIC(12,4) NOT NULL,
  unit_cost     NUMERIC(14,4) NOT NULL DEFAULT 0,
  qty_before    NUMERIC(12,4) NOT NULL,
  qty_after     NUMERIC(12,4) NOT NULL,
  purpose       VARCHAR(20)
                  CHECK (purpose IN ('WORK_ORDER','EMERGENCY','PREVENTIVE','CORRECTIVE','CYCLE_COUNT')),
  equipment_id  INT REFERENCES equipment(id) ON DELETE SET NULL,
  batch_number  VARCHAR(100),
  serial_number VARCHAR(100),
  expiry_date   DATE,
  notes         TEXT,
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_part    ON stock_ledger(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_created ON stock_ledger(created_at DESC);

-- Materialised stock balances (kept current by trigger)
CREATE TABLE IF NOT EXISTS stock_balances (
  part_id           INT NOT NULL REFERENCES spare_parts(id)       ON DELETE CASCADE,
  location_id       INT NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
  qty_on_hand       NUMERIC(12,4) NOT NULL DEFAULT 0,
  qty_reserved      NUMERIC(12,4) NOT NULL DEFAULT 0,
  weighted_avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  last_movement     TIMESTAMPTZ,
  PRIMARY KEY (part_id, location_id)
);

-- Reservations (soft-hold for upcoming work orders)
CREATE TABLE IF NOT EXISTS stock_reservations (
  id             SERIAL PRIMARY KEY,
  part_id        INT NOT NULL REFERENCES spare_parts(id)       ON DELETE CASCADE,
  location_id    INT NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
  qty_reserved   NUMERIC(12,4) NOT NULL,
  purpose        VARCHAR(100),
  work_order_ref VARCHAR(100),
  reserved_by    UUID NOT NULL REFERENCES users(id),
  reserved_until TIMESTAMPTZ,
  status         VARCHAR(20) DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','FULFILLED','CANCELLED','EXPIRED')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Reorder / stockout alerts
CREATE TABLE IF NOT EXISTS reorder_alerts (
  id            SERIAL PRIMARY KEY,
  part_id       INT NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  alert_type    VARCHAR(20) NOT NULL
                  CHECK (alert_type IN (
                    'LOW_STOCK','STOCKOUT','REORDER_DUE',
                    'EXCESS_STOCK','SLOW_MOVING','EXPIRY_SOON'
                  )),
  current_qty   NUMERIC(12,4),
  threshold_qty NUMERIC(12,4),
  severity      VARCHAR(10) DEFAULT 'MEDIUM'
                  CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  is_resolved   BOOLEAN DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Daily consumption aggregation (for forecasting)
CREATE TABLE IF NOT EXISTS consumption_history (
  part_id      INT  NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
  period_date  DATE NOT NULL,
  qty_consumed NUMERIC(12,4) NOT NULL DEFAULT 0,
  txn_count    INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (part_id, period_date)
);

-- ── Trigger: update stock_balances on every stock_ledger insert ───────────────
CREATE OR REPLACE FUNCTION update_stock_balance() RETURNS TRIGGER AS $$
DECLARE
  cur_qty  NUMERIC(14,4) := 0;
  cur_wavg NUMERIC(14,4) := 0;
  new_wavg NUMERIC(14,4);
BEGIN
  SELECT qty_on_hand, weighted_avg_cost
  INTO cur_qty, cur_wavg
  FROM stock_balances
  WHERE part_id = NEW.part_id AND location_id = NEW.location_id;

  IF cur_qty IS NULL THEN cur_qty := 0; cur_wavg := 0; END IF;

  -- Recalculate weighted average only when stock comes in at a cost
  IF NEW.qty > 0 AND NEW.unit_cost > 0 THEN
    new_wavg := CASE
      WHEN (cur_qty + NEW.qty) = 0 THEN 0
      ELSE (cur_qty * cur_wavg + NEW.qty * NEW.unit_cost) / (cur_qty + NEW.qty)
    END;
  ELSE
    new_wavg := cur_wavg;
  END IF;

  INSERT INTO stock_balances (part_id, location_id, qty_on_hand, weighted_avg_cost, last_movement)
  VALUES (NEW.part_id, NEW.location_id, NEW.qty, new_wavg, NEW.created_at)
  ON CONFLICT (part_id, location_id) DO UPDATE SET
    qty_on_hand       = stock_balances.qty_on_hand + NEW.qty,
    weighted_avg_cost = new_wavg,
    last_movement     = NEW.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_balance ON stock_ledger;
CREATE TRIGGER trg_stock_balance
AFTER INSERT ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION update_stock_balance();

-- ── Trigger: update consumption_history on STOCK_OUT ─────────────────────────
CREATE OR REPLACE FUNCTION update_consumption_history() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.txn_type = 'STOCK_OUT' THEN
    INSERT INTO consumption_history (part_id, period_date, qty_consumed, txn_count)
    VALUES (NEW.part_id, CURRENT_DATE, ABS(NEW.qty), 1)
    ON CONFLICT (part_id, period_date) DO UPDATE SET
      qty_consumed = consumption_history.qty_consumed + ABS(NEW.qty),
      txn_count    = consumption_history.txn_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consumption_history ON stock_ledger;
CREATE TRIGGER trg_consumption_history
AFTER INSERT ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION update_consumption_history();
