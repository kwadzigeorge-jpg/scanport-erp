-- ============================================================
-- MIGRATION 003: Truck Allocations + 60 Bays + Container Size
-- ============================================================

-- 1. Add new columns to container_transactions (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='container_transactions' AND column_name='container_size') THEN
    ALTER TABLE container_transactions ADD COLUMN container_size VARCHAR(10) DEFAULT '20ft';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='container_transactions' AND column_name='driver_name') THEN
    ALTER TABLE container_transactions ADD COLUMN driver_name VARCHAR(150);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='container_transactions' AND column_name='driver_phone') THEN
    ALTER TABLE container_transactions ADD COLUMN driver_phone VARCHAR(30);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='container_transactions' AND column_name='truck_allocation_id') THEN
    ALTER TABLE container_transactions ADD COLUMN truck_allocation_id UUID;
  END IF;
END $$;

-- 2. Truck allocations table
CREATE TABLE IF NOT EXISTS truck_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_ref  VARCHAR(25) UNIQUE NOT NULL,
  truck_number    VARCHAR(30) NOT NULL,
  driver_name     VARCHAR(150),
  driver_phone    VARCHAR(30),
  agent_name      VARCHAR(150) NOT NULL,
  agent_phone     VARCHAR(30) NOT NULL,
  holding_area_id INT REFERENCES holding_areas(id),
  bay_id          INT REFERENCES bays(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'IN_BAY',
  time_in         TIMESTAMPTZ DEFAULT NOW(),
  time_out        TIMESTAMPTZ,
  dwell_minutes   INT,
  created_by      UUID REFERENCES users(id),
  released_by     UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_status  ON truck_allocations(status);
CREATE INDEX IF NOT EXISTS idx_ta_bay     ON truck_allocations(bay_id);
CREATE INDEX IF NOT EXISTS idx_ta_created ON truck_allocations(created_at);

-- 3. FK from container_transactions to truck_allocations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='fk_ct_truck_alloc' AND table_name='container_transactions'
  ) THEN
    ALTER TABLE container_transactions
      ADD CONSTRAINT fk_ct_truck_alloc
      FOREIGN KEY (truck_allocation_id) REFERENCES truck_allocations(id);
  END IF;
END $$;

-- 4. Rebuild bays: 30 per holding area = 60 total
-- Clear existing test allocations and bays first
DELETE FROM container_transactions WHERE bay_id IS NOT NULL;
DELETE FROM bays;

INSERT INTO bays (holding_area_id, bay_code, capacity)
SELECT ha.id, 'BAY-' || LPAD(n::TEXT, 2, '0'), 1
FROM holding_areas ha CROSS JOIN generate_series(1, 30) n;

-- 5. Trigger for truck_allocations updated_at
CREATE OR REPLACE TRIGGER trg_ta_updated_at
  BEFORE UPDATE ON truck_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
