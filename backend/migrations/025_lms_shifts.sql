-- Monthly shift schedules per staff member
CREATE TABLE IF NOT EXISTS lms_shifts (
  id         SERIAL PRIMARY KEY,
  staff_id   INT REFERENCES lms_staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL
    CHECK (shift_type IN (
      'days_exp','days_imp','days_int','days',
      'nights_exp','nights_imp','nights_int','nights',
      'rest','flexi'
    )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, shift_date)
);
CREATE INDEX IF NOT EXISTS lms_shifts_date_idx ON lms_shifts(shift_date);
CREATE INDEX IF NOT EXISTS lms_shifts_staff_idx ON lms_shifts(staff_id);
