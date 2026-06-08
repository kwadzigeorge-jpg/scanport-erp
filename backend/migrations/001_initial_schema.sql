-- ============================================================
-- PORT TERMINAL ERP - DATABASE SCHEMA
-- ============================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,  -- admin, supervisor, booth_officer, marshal
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

-- Role <-> Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username            VARCHAR(50) UNIQUE NOT NULL,
  email               VARCHAR(150) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  full_name           VARCHAR(150) NOT NULL,
  role_id             INT REFERENCES roles(id) NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  last_login          TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  failed_login_attempts INT DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Active JWT sessions (for single-session enforcement & invalidation)
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- Holding Areas (physical zones in the terminal)
CREATE TABLE IF NOT EXISTS holding_areas (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bays within each holding area
CREATE TABLE IF NOT EXISTS bays (
  id              SERIAL PRIMARY KEY,
  holding_area_id INT REFERENCES holding_areas(id) ON DELETE CASCADE,
  bay_code        VARCHAR(30) NOT NULL,
  capacity        INT DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE(holding_area_id, bay_code)
);

-- Container Transactions (core table)
CREATE TABLE IF NOT EXISTS container_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      VARCHAR(20) UNIQUE NOT NULL,   -- human-readable e.g. TXN-20240408-0001
  container_number    VARCHAR(11) NOT NULL,           -- ISO: 4 uppercase letters + 7 digits
  agent_name          VARCHAR(150) NOT NULL,
  agent_phone         VARCHAR(30) NOT NULL,
  truck_number        VARCHAR(30),
  holding_area_id     INT REFERENCES holding_areas(id),
  bay_id              INT REFERENCES bays(id),
  status              VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                      -- PENDING | IN_HOLDING_AREA | EXITED | CANCELLED
  qr_code_data        TEXT,                           -- base64 PNG or SVG
  qr_code_token       TEXT UNIQUE,                    -- signed JWT token embedded in QR
  time_in             TIMESTAMPTZ,                    -- confirmed entry time
  time_out            TIMESTAMPTZ,                    -- exit time
  dwell_minutes       INT,                            -- auto-calculated on exit
  created_by          UUID REFERENCES users(id),      -- booth officer
  confirmed_entry_by  UUID REFERENCES users(id),      -- marshal
  confirmed_exit_by   UUID REFERENCES users(id),      -- marshal
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ct_status       ON container_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ct_container    ON container_transactions(container_number);
CREATE INDEX IF NOT EXISTS idx_ct_created_at   ON container_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ct_time_in      ON container_transactions(time_in);

-- Audit Log (immutable – no DELETE/UPDATE allowed in app layer)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  username    VARCHAR(50),
  role        VARCHAR(50),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50),           -- 'container_transaction', 'user', etc.
  entity_id   TEXT,
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date   ON audit_logs(created_at);

-- System configuration (key-value store for admin-configurable thresholds)
CREATE TABLE IF NOT EXISTS system_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_ct_updated_at
  BEFORE UPDATE ON container_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
