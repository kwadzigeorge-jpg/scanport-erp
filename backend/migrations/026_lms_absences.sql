-- Staff absence records for tracking unplanned absences and trends
CREATE TABLE IF NOT EXISTS lms_absences (
  id           SERIAL PRIMARY KEY,
  staff_id     INT REFERENCES lms_staff(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  days         INT NOT NULL DEFAULT 1,
  reason       VARCHAR(50) NOT NULL
    CHECK (reason IN ('sick','family_emergency','no_reason','unauthorized',
                      'transport','bereavement','personal','other')),
  notes        TEXT,
  shift_missed VARCHAR(20),
  status       VARCHAR(20) NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded','acknowledged','excused','disciplinary')),
  logged_by    VARCHAR(200),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lms_absences_staff_idx ON lms_absences(staff_id);
CREATE INDEX IF NOT EXISTS lms_absences_date_idx  ON lms_absences(start_date);
