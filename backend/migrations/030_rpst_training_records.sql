-- 030_rpst_training_records.sql
-- Import historical NRA Radiation Safety Training (RST) records
-- Batch 1: Nov 15-17 2022 | Expires Oct 2025  (17 staff)
-- Batch 2: Jan 17-19 2023 | Expires Dec 2025  (21 staff)
-- Batch 3: Jan 23-25 2023 | Expires Dec 2025  (20 staff)
-- All records expired as of June 2026 — staff require renewal

-- NRA certifies for 3 years; update validity accordingly
UPDATE training_types SET validity_months = 36 WHERE code = 'RPST';

DO $$
DECLARE
  v_type_id  INT;
  v_admin_id INT;
  v_count    INT;
BEGIN
  SELECT id INTO v_type_id  FROM training_types WHERE code = 'RPST';
  SELECT id INTO v_admin_id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1;

  IF v_type_id IS NULL THEN
    RAISE NOTICE '030: RPST training type not found — skipping import';
    RETURN;
  END IF;

  -- ── Batch 1 ── Nov 15–17, 2022 | Expires Oct 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes, recorded_by)
  SELECT s.id, v_type_id, '2022-11-17', '2025-10-31',
         'NRA Radiation Safety Training – Batch 1', v_admin_id
  FROM   lms_staff s
  WHERE  LOWER(TRIM(s.name)) IN (
    'abdul-malik osumanu',
    'bismack acheampong',
    'carl selassie tsatsu',
    'derrick adjei',
    'ebenezer kweku mensah',
    'enoch adjei agyapong',
    'esther dabier',
    'evelyn ashitey',
    'janet ofosua agyei-gyane',
    'joseph kang-kpiinuu dabuo',
    'kwabena akosa',
    'michael fiawoyife',
    'nana yaw mantey',
    'nunnisun miniyelibu',
    'priscilla baaba ouagraine',
    'samuel kwabena agyemang',
    'seth ampem'
  )
  AND NOT EXISTS (
    SELECT 1 FROM staff_training_records r
    WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 1 — % records inserted', v_count;

  -- ── Batch 2 ── Jan 17–19, 2023 | Expires Dec 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes, recorded_by)
  SELECT s.id, v_type_id, '2023-01-19', '2025-12-31',
         'NRA Radiation Safety Training – Batch 2', v_admin_id
  FROM   lms_staff s
  WHERE  LOWER(TRIM(s.name)) IN (
    'alex danquah-smith',
    'bridget fatima malik',
    'dennis gardiner',
    'elsie nana amanua ankrah',
    'emmanuel adjei',
    'eric wiafe agyekum',
    'eugenia ewura adjoa abbeo',
    'evelyn sackey',
    'frederick ankrah',
    'gifty d. ampaabeng',
    'gifty ampaabeng',
    'isaac kofi ohene',
    'jasper frimpong',
    'jessica ama budu',
    'juliana kessewah affum',
    'kristopher ohene-sam',
    'kwaku amoako-atta',
    'mary abalo',
    'pamela lamptey-mills',
    'paul yirebaare continua',
    'sarah m. adjabeng',
    'sarah adjabeng',
    'seth ampofo'
  )
  AND NOT EXISTS (
    SELECT 1 FROM staff_training_records r
    WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 2 — % records inserted', v_count;

  -- ── Batch 3 ── Jan 23–25, 2023 | Expires Dec 31, 2025 ──────────────────────
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes, recorded_by)
  SELECT s.id, v_type_id, '2023-01-25', '2025-12-31',
         'NRA Radiation Safety Training – Batch 3', v_admin_id
  FROM   lms_staff s
  WHERE  LOWER(TRIM(s.name)) IN (
    'ampartey boateng',
    'andrew okyere agyekum nsowah',
    'charles osafo',
    'dabuq david',
    'david dabuq',
    'justina sarfowaa fosu',
    'kusark emmanuel yaw',
    'kwadwo aboagye asah-opoku',
    'kwadzi george gameli',
    'kwesi ofori-boateng',
    'linda debrah',
    'linda mokoah otwey',
    'maxwell forson adjei',
    'nii dodoo decardi-nelson',
    'paul essien',
    'raymond adu parkoh',
    'richard ampadu ofori',
    'roland abeiku egyir',
    'sahanun mubarik',
    'sitsope cudjoe',
    'wendy nako lartey'
  )
  AND NOT EXISTS (
    SELECT 1 FROM staff_training_records r
    WHERE r.staff_id = s.id AND r.training_type_id = v_type_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '030: Batch 3 — % records inserted', v_count;

END;
$$;
