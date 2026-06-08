-- Expand maintenance_type CHECK constraint to include corrective and PMI types
ALTER TABLE compliance_maintenance
  DROP CONSTRAINT IF EXISTS compliance_maintenance_maintenance_type_check;

ALTER TABLE compliance_maintenance
  ADD CONSTRAINT compliance_maintenance_maintenance_type_check
  CHECK (maintenance_type IN (
    'pmi_l1','pmi_l2','pmi_l3',
    'corrective_l2','corrective_l3',
    'level_1_routine','level_2_preventive','level_3_major_overhaul',
    'calibration','software_update','hardware_inspection'
  ));
