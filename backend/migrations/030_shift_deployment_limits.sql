-- Migration 030: Shift deployment limits
-- Defines the maximum number of gangs that can be allocated per day/shift

CREATE TABLE IF NOT EXISTS shift_deployment_limits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT         NOT NULL,   -- 0=Sunday, 1=Monday, ..., 6=Saturday
  shift       VARCHAR(10) NOT NULL,   -- 'day' | 'night'
  max_gangs   INT         NOT NULL,
  UNIQUE (day_of_week, shift)
);

INSERT INTO shift_deployment_limits (day_of_week, shift, max_gangs) VALUES
  (1, 'day',   30), (1, 'night', 30),
  (2, 'day',   40), (2, 'night', 40),
  (3, 'day',   50), (3, 'night', 45),
  (4, 'day',   50), (4, 'night', 45),
  (5, 'day',   50), (5, 'night', 45),
  (6, 'day',   35), (6, 'night', 25),
  (0, 'day',    5), (0, 'night',  5)
ON CONFLICT (day_of_week, shift) DO NOTHING;
