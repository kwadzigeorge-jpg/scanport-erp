-- 041_fleet_trip_workflow.sql
-- Split trip logging into start and end steps

-- Make odometer_end nullable so a trip can be started without the end reading
ALTER TABLE fleet_mileage_logs ALTER COLUMN odometer_end DROP NOT NULL;

-- trip_status tracks whether the trip is still in progress or completed
-- (separate from status which is the approval workflow)
ALTER TABLE fleet_mileage_logs
  ADD COLUMN IF NOT EXISTS trip_status VARCHAR(10) NOT NULL DEFAULT 'completed'
  CHECK (trip_status IN ('open', 'completed'));

-- All existing rows are already fully logged, mark them completed
UPDATE fleet_mileage_logs SET trip_status = 'completed' WHERE trip_status = 'completed';
