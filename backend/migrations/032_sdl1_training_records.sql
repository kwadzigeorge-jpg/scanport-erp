-- 032_sdl1_training_records.sql
-- HCVP, SO/SL1 Training (Smiths Detection Level 1) — 44 staff
-- Training dates: March 15/19/22/26/27 and May 7, 2025
-- All expire 2027 — CURRENT as of June 2026

DO $$
DECLARE
  v_type_id INT;
  v_count   INT;
  v_total   INT := 0;
BEGIN
  SELECT id INTO v_type_id FROM training_types WHERE code = 'SDL1';

  IF v_type_id IS NULL THEN
    RAISE NOTICE '032: SDL1 training type not found — skipping';
    RETURN;
  END IF;

  -- ── 15 March 2025 ── expires 15/03/2027 ─────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-03-15', '2027-03-15', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%lilian%'   AND s.name ILIKE '%osei%')
   OR (s.name ILIKE '%dennis%'   AND s.name ILIKE '%gardiner%')
   OR (s.name ILIKE '%eric%'     AND s.name ILIKE '%mensah%' AND s.name ILIKE '%obrey%')
   OR (s.name ILIKE '%eric%'     AND s.name ILIKE '%obrey%')
   OR (s.name ILIKE '%kwabena%'  AND s.name ILIKE '%akosa%')
   OR (s.name ILIKE '%david%'    AND (s.name ILIKE '%dabuq%' OR s.name ILIKE '%dabug%'))
   OR (s.name ILIKE '%kwesi%'    AND s.name ILIKE '%ofori%')
   OR (s.name ILIKE '%maud%'     AND s.name ILIKE '%osei%')
   OR (s.name ILIKE '%stacey%'   AND s.name ILIKE '%adjei%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 15 Mar — % records', v_count;

  -- ── 19 March 2025 ── expires 19/03/2027 ─────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-03-19', '2027-03-19', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%abdul%'    AND s.name ILIKE '%rahman%')
   OR (s.name ILIKE '%imran%')
   OR (s.name ILIKE '%matthew%'  AND s.name ILIKE '%mertz%')
   OR (s.name ILIKE '%joseph%'   AND s.name ILIKE '%dabuo%')
   OR (s.name ILIKE '%pamela%'   AND s.name ILIKE '%lamptey%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 19 Mar — % records', v_count;

  -- ── 22 March 2025 ── expires 22/03/2027 ─────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-03-22', '2027-03-22', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%eugenia%'  AND s.name ILIKE '%abbeo%')
   OR (s.name ILIKE '%abdul%'    AND s.name ILIKE '%osumanu%')
   OR (s.name ILIKE '%evelyn%'   AND s.name ILIKE '%ashitey%')
   OR (s.name ILIKE '%sitsop%'   OR  s.name ILIKE '%sitsof%')
   OR (s.name ILIKE '%emmanuel%' AND s.name ILIKE '%ackah%')
   OR (s.name ILIKE '%enoch%'    AND s.name ILIKE '%agyapong%')
   OR (s.name ILIKE '%linda%'    AND s.name ILIKE '%debrah%')
   OR (s.name ILIKE '%kusark%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 22 Mar — % records', v_count;

  -- ── 26 March 2025 ── expires 26/03/2027 ─────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-03-26', '2027-03-26', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%kwaku%'    AND s.name ILIKE '%amoako%')
   OR (s.name ILIKE '%bridget%'  AND s.name ILIKE '%malik%')
   OR (s.name ILIKE '%bismack%')
   OR (s.name ILIKE '%roland%'   AND s.name ILIKE '%egyir%')
   OR (s.name ILIKE '%gifty%'    AND s.name ILIKE '%ampaabeng%')
   OR (s.name ILIKE '%juliana%'  AND s.name ILIKE '%affum%')
   OR (s.name ILIKE '%kwadwo%'   AND s.name ILIKE '%asah%')
   OR (s.name ILIKE '%paul%'     AND s.name ILIKE '%essien%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 26 Mar — % records', v_count;

  -- ── 27 March 2025 ── expires 27/03/2027 ─────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-03-27', '2027-03-27', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%bright%'    AND s.name ILIKE '%nyadzr%')
   OR (s.name ILIKE '%emmanuel%'  AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%florence%'  AND s.name ILIKE '%kapr%')
   OR (s.name ILIKE '%frederick%' AND s.name ILIKE '%ankrah%')
   OR (s.name ILIKE '%isaac%'     AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%justina%'   AND s.name ILIKE '%fosu%')
   OR (s.name ILIKE '%linda%'     AND s.name ILIKE '%otwey%')
   OR (s.name ILIKE '%wendy%'     AND s.name ILIKE '%lartey%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 27 Mar — % records', v_count;

  -- ── 07 May 2025 ── expires 07/05/2027 ───────────────────────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_type_id, '2025-05-07', '2027-05-07', 'HCVP SO/SL1 Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%andrew%'    AND s.name ILIKE '%nsowah%')
   OR (s.name ILIKE '%angela%'    AND s.name ILIKE '%agyemang%')
   OR (s.name ILIKE '%dorcas%'    AND s.name ILIKE '%gaayuoni%')
   OR (s.name ILIKE '%esther%'    AND s.name ILIKE '%dabier%')
   OR (s.name ILIKE '%frank%'     AND s.name ILIKE '%hayford%')
   OR (s.name ILIKE '%godfrey%'   AND s.name ILIKE '%nyame%')
   OR (s.name ILIKE '%priscilla%' AND s.name ILIKE '%quagraine%')
   OR (s.name ILIKE '%priscilla%' AND s.name ILIKE '%ouagraine%')
   OR (s.name ILIKE '%sarah%'     AND s.name ILIKE '%adjabeng%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;
  RAISE NOTICE '032: 07 May — % records', v_count;

  RAISE NOTICE '032: SDL1 total — % of 44 records inserted', v_total;
END;
$$;
