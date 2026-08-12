-- Add Holding Area Charlie with reefer bays 27-30 and 77-80

INSERT INTO holding_areas (name, code, description)
VALUES ('Holding Area Charlie', 'HA-C', 'Reefer examination platform')
ON CONFLICT (code) DO NOTHING;

-- Insert reefer bays into Charlie
WITH charlie AS (
  SELECT id FROM holding_areas WHERE code = 'HA-C'
)
INSERT INTO bays (holding_area_id, bay_code, capacity, is_reefer)
SELECT charlie.id, bay_code, 1, TRUE
FROM charlie,
(VALUES
  ('BAY-27'), ('BAY-28'), ('BAY-29'), ('BAY-30'),
  ('BAY-77'), ('BAY-78'), ('BAY-79'), ('BAY-80')
) AS t(bay_code)
ON CONFLICT (holding_area_id, bay_code) DO NOTHING;
