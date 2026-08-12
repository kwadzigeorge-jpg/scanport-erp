-- Allow truck_number to be NULL for reefer allocations where the truck
-- plate is not known at booking time.
ALTER TABLE truck_allocations
  ALTER COLUMN truck_number DROP NOT NULL;
