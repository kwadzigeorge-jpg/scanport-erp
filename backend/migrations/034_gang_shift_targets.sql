-- 034_gang_shift_targets.sql
-- Weekly deployment targets per shift (morning / night)

CREATE TABLE IF NOT EXISTS gang_shift_targets (
  id          SERIAL PRIMARY KEY,
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  day_name    VARCHAR(10) NOT NULL,
  morning     INT NOT NULL DEFAULT 0,
  night       INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- day_of_week: 0=Sunday ... 6=Saturday (matches JS Date.getDay())
INSERT INTO gang_shift_targets (day_of_week, day_name, morning, night) VALUES
  (0, 'Sunday',     5,  5),
  (1, 'Monday',    30, 30),
  (2, 'Tuesday',   40, 40),
  (3, 'Wednesday', 50, 45),
  (4, 'Thursday',  50, 45),
  (5, 'Friday',    50, 45),
  (6, 'Saturday',  35, 25)
ON CONFLICT (day_of_week) DO UPDATE
  SET morning    = EXCLUDED.morning,
      night      = EXCLUDED.night,
      updated_at = NOW();
