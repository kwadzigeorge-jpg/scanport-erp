-- 036_fleet_management.sql
-- Fleet vehicles, drivers, mileage logs, fuel logs, maintenance records, alerts

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number  VARCHAR(20) NOT NULL UNIQUE,
  make                 VARCHAR(60) NOT NULL,
  model                VARCHAR(60) NOT NULL,
  year_of_manufacture  SMALLINT,
  chassis_number       VARCHAR(60) UNIQUE,
  engine_number        VARCHAR(60),
  department_id        INT         REFERENCES lms_teams(id),
  fuel_type            VARCHAR(15) NOT NULL DEFAULT 'diesel'
                         CHECK (fuel_type IN ('diesel','petrol','electric','hybrid','lpg')),
  tank_capacity_litres NUMERIC(8,2),
  service_interval_km  INT         NOT NULL DEFAULT 5000,
  insurance_expiry     DATE,
  roadworthy_expiry    DATE,
  current_odometer_km  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status               VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','under_maintenance','out_of_service')),
  notes                TEXT,
  created_by           UUID        REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_drivers (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        INT          REFERENCES lms_staff(id),
  employee_number VARCHAR(30)  UNIQUE,
  full_name       VARCHAR(200) NOT NULL,
  phone           VARCHAR(20),
  license_number  VARCHAR(50)  NOT NULL UNIQUE,
  license_class   VARCHAR(20),
  license_expiry  DATE         NOT NULL,
  department_id   INT          REFERENCES lms_teams(id),
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended')),
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_drivers (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID    NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  driver_id       UUID    NOT NULL REFERENCES fleet_drivers(id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, driver_id)
);

CREATE TABLE IF NOT EXISTS fleet_mileage_logs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        UUID         NOT NULL REFERENCES fleet_vehicles(id),
  driver_id         UUID         NOT NULL REFERENCES fleet_drivers(id),
  trip_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  trip_start_time   TIME,
  trip_end_time     TIME,
  odometer_start    NUMERIC(10,2) NOT NULL,
  odometer_end      NUMERIC(10,2) NOT NULL,
  distance_km       NUMERIC(10,2) GENERATED ALWAYS AS (odometer_end - odometer_start) STORED,
  trip_purpose      VARCHAR(200)  NOT NULL,
  origin            VARCHAR(200),
  destination       VARCHAR(200),
  fuel_added_litres NUMERIC(8,2),
  fuel_cost         NUMERIC(10,2),
  is_flagged        BOOLEAN      NOT NULL DEFAULT FALSE,
  flag_reason       TEXT,
  remarks           TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  approved_by       UUID         REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  recorded_by       UUID         NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fleet_odo CHECK (odometer_end >= odometer_start)
);

CREATE TABLE IF NOT EXISTS fleet_fuel_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID         NOT NULL REFERENCES fleet_vehicles(id),
  driver_id      UUID         REFERENCES fleet_drivers(id),
  fuel_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
  litres         NUMERIC(8,2) NOT NULL,
  cost_per_litre NUMERIC(8,3),
  total_cost     NUMERIC(10,2),
  odometer_km    NUMERIC(10,2) NOT NULL,
  fuel_station   VARCHAR(200),
  receipt_number VARCHAR(50),
  recorded_by    UUID         NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_maintenance_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID        NOT NULL REFERENCES fleet_vehicles(id),
  maintenance_type    VARCHAR(25) NOT NULL
                        CHECK (maintenance_type IN ('preventive','corrective','repair','inspection','parts_replacement')),
  description         TEXT        NOT NULL,
  workshop            VARCHAR(200),
  cost                NUMERIC(12,2),
  service_date        DATE        NOT NULL,
  odometer_at_service NUMERIC(10,2),
  next_service_km     NUMERIC(10,2),
  start_date          DATE,
  end_date            DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  recorded_by         UUID        NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        REFERENCES fleet_vehicles(id)  ON DELETE CASCADE,
  driver_id    UUID        REFERENCES fleet_drivers(id)   ON DELETE CASCADE,
  alert_type   VARCHAR(30) NOT NULL
                 CHECK (alert_type IN ('service_due','service_overdue','insurance_expiry',
                                       'roadworthy_expiry','license_expiry',
                                       'abnormal_fuel','abnormal_mileage')),
  message      TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_status     ON fleet_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_fleet_mileage_vehicle     ON fleet_mileage_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_mileage_date        ON fleet_mileage_logs(trip_date);
CREATE INDEX IF NOT EXISTS idx_fleet_mileage_status      ON fleet_mileage_logs(status);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_vehicle        ON fleet_fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maint_vehicle       ON fleet_maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_active       ON fleet_alerts(is_dismissed, created_at);
