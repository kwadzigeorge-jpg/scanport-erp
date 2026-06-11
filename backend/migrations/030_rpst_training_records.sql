-- 030_rpst_training_records.sql
-- Import historical NRA Radiation Safety Training (RST) records
-- Batch 1: Nov 15-17 2022 | Expires Oct 2025  (17 staff)
-- Batch 2: Jan 17-19 2023 | Expires Dec 2025  (21 staff)
-- Batch 3: Jan 23-25 2023 | Expires Dec 2025  (20 staff)
-- All records expired as of June 2026 — staff require renewal
-- Uses ILIKE fragment matching to handle abbreviated/reordered names in lms_staff

-- NRA certifies for 3 years; update validity accordingly
UPDATE training_types SET validity_months = 36 WHERE code = 'RPST';

DO $$
DECLARE
  v_type_id INT;
  v_count   INT;
BEGIN
  SELECT id INTO v_type_id FROM training_types WHERE code = 'RPST';

  IF v_type_id IS NULL THEN
    RAISE NOTICE '030: RPST training type not found — skipping import';
    RETURN;
  END IF;

  -- ── Batch 1 ── Nov 15–17, 2022 | Expires Oct 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2022-11-17', '2025-10-31',
         'NRA Radiation Safety Training – Batch 1'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%abdul%'    AND s.name ILIKE '%osumanu%')
   OR (s.name ILIKE '%bismack%')
   OR (s.name ILIKE '%carl%'     AND s.name ILIKE '%tsatsu%')
   OR (s.name ILIKE '%derrick%'  AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%ebenezer%' AND s.name ILIKE '%mensah%')
   OR (s.name ILIKE '%enoch%'    AND s.name ILIKE '%agyapong%')
   OR (s.name ILIKE '%esther%'   AND s.name ILIKE '%dabier%')
   OR (s.name ILIKE '%evelyn%'   AND s.name ILIKE '%ashitey%')
   OR (s.name ILIKE '%janet%'    AND s.name ILIKE '%agyei%')
   OR (s.name ILIKE '%joseph%'   AND s.name ILIKE '%dabuo%')
   OR (s.name ILIKE '%kwabena%'  AND s.name ILIKE '%akosa%')
   OR (s.name ILIKE '%michael%'  AND s.name ILIKE '%fiawoyife%')
   OR (s.name ILIKE '%nana%'     AND s.name ILIKE '%mantey%')
   OR (s.name ILIKE '%nunnisun%')
   OR (s.name ILIKE '%priscilla%' AND s.name ILIKE '%ouagraine%')
   OR (s.name ILIKE '%samuel%'   AND s.name ILIKE '%agyemang%')
   OR (s.name ILIKE '%seth%'     AND s.name ILIKE '%ampem%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 1 — % records inserted', v_count;

  -- ── Batch 2 ── Jan 17–19, 2023 | Expires Dec 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2023-01-19', '2025-12-31',
         'NRA Radiation Safety Training – Batch 2'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%alex%'      AND s.name ILIKE '%danquah%')
   OR (s.name ILIKE '%bridget%'   AND s.name ILIKE '%malik%')
   OR (s.name ILIKE '%dennis%'    AND s.name ILIKE '%gardiner%')
   OR (s.name ILIKE '%elsie%'     AND s.name ILIKE '%ankrah%')
   OR (s.name ILIKE '%emmanuel%'  AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%eric%'      AND s.name ILIKE '%wiafe%')
   OR (s.name ILIKE '%eugenia%'   AND s.name ILIKE '%abbeo%')
   OR (s.name ILIKE '%evelyn%'    AND s.name ILIKE '%sackey%')
   OR (s.name ILIKE '%frederick%' AND s.name ILIKE '%ankrah%')
   OR (s.name ILIKE '%gifty%'     AND s.name ILIKE '%ampaabeng%')
   OR (s.name ILIKE '%isaac%'     AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%jasper%'    AND s.name ILIKE '%frimpong%')
   OR (s.name ILIKE '%jessica%'   AND s.name ILIKE '%budu%')
   OR (s.name ILIKE '%juliana%'   AND s.name ILIKE '%affum%')
   OR (s.name ILIKE '%kristopher%' AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%kwaku%'     AND s.name ILIKE '%amoako%')
   OR (s.name ILIKE '%mary%'      AND s.name ILIKE '%abalo%')
   OR (s.name ILIKE '%pamela%'    AND s.name ILIKE '%lamptey%')
   OR (s.name ILIKE '%paul%'      AND s.name ILIKE '%yirebaare%')
   OR (s.name ILIKE '%sarah%'     AND s.name ILIKE '%adjabeng%')
   OR (s.name ILIKE '%seth%'      AND s.name ILIKE '%ampofo%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 2 — % records inserted', v_count;

  -- ── Batch 3 ── Jan 23–25, 2023 | Expires Dec 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2023-01-25', '2025-12-31',
         'NRA Radiation Safety Training – Batch 3'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%ampartey%'   AND s.name ILIKE '%boateng%')
   OR (s.name ILIKE '%andrew%'     AND s.name ILIKE '%nsowah%')
   OR (s.name ILIKE '%charles%'    AND s.name ILIKE '%osafo%')
   OR (s.name ILIKE '%dabuq%'      OR  s.name ILIKE '%dabug%')
   OR (s.name ILIKE '%justina%'    AND s.name ILIKE '%fosu%')
   OR (s.name ILIKE '%kusark%')
   OR (s.name ILIKE '%kwadwo%'     AND s.name ILIKE '%asah%')
   OR (s.name ILIKE '%kwadzi%'     OR  s.name ILIKE '%gameli%')
   OR (s.name ILIKE '%kwesi%'      AND s.name ILIKE '%ofori%')
   OR (s.name ILIKE '%linda%'      AND s.name ILIKE '%debrah%')
   OR (s.name ILIKE '%linda%'      AND s.name ILIKE '%otwey%')
   OR (s.name ILIKE '%maxwell%'    AND s.name ILIKE '%forson%')
   OR (s.name ILIKE '%nii%'        AND s.name ILIKE '%decardi%')
   OR (s.name ILIKE '%paul%'       AND s.name ILIKE '%essien%')
   OR (s.name ILIKE '%raymond%'    AND s.name ILIKE '%parkoh%')
   OR (s.name ILIKE '%richard%'    AND s.name ILIKE '%ampadu%')
   OR (s.name ILIKE '%roland%'     AND s.name ILIKE '%egyir%')
   OR (s.name ILIKE '%sahanun%')
   OR (s.name ILIKE '%sitsope%')
   OR (s.name ILIKE '%wendy%'      AND s.name ILIKE '%lartey%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 3 — % records inserted', v_count;

END;
$$;
