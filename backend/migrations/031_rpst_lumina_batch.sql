-- 031_rpst_lumina_batch.sql
-- Lumina RST Radiation Safety Training | Nov 28–30, 2023 | Expires Dec 2026
-- 4 staff — records are CURRENT as of June 2026

DO $$
DECLARE
  v_type_id INT;
  v_count   INT;
BEGIN
  SELECT id INTO v_type_id FROM training_types WHERE code = 'RPST';

  IF v_type_id IS NULL THEN
    RAISE NOTICE '031: RPST training type not found — skipping';
    RETURN;
  END IF;

  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2023-11-30', '2026-12-31',
         'Lumina RST Radiation Safety Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%ackah%'   AND s.name ILIKE '%anvo%')
   OR (s.name ILIKE '%ackah%'   AND s.name ILIKE '%emmanuel%')
   OR (s.name ILIKE '%amanda%'  AND s.name ILIKE '%mensah%')
   OR (s.name ILIKE '%angela%'  AND s.name ILIKE '%agyemang%')
   OR (s.name ILIKE '%lily%'    AND s.name ILIKE '%acheampong%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id
        AND r.training_type_id = v_type_id
        AND r.completion_date = '2023-11-30'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '031: Lumina RST batch — % records inserted', v_count;
END;
$$;
