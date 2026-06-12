-- 033_bvt_iso45_sdl2_records.sql
-- Bureau Veritas: Hazard ID/HSE (BVT) — 18 staff, Jul–Aug 2024
-- Bureau Veritas: ISO 45001:2018 Internal Auditors (new type) — 19 staff
-- Smiths Detection SL2 (SDL2) — 9 staff, Apr 2025, expires Apr 2027
-- HCVP Image Operator (new type) — 2 staff visible, May 2025
-- BVT/ISO expiry not stated in source — calculated at 24 months

-- ── New training types ────────────────────────────────────────────────────────
INSERT INTO training_types (name, code, validity_months, description) VALUES
  ('ISO 45001:2018 Internal Auditors',  'ISO45',  24,
   'Bureau Veritas ISO 45001:2018 Occupational H&S Management Systems — Internal Auditors Course'),
  ('HCVP Image Operator Training',      'HCVPIO', 24,
   'Smiths Detection HCVP Image Operator (IO) certification')
ON CONFLICT (code) DO NOTHING;

-- Grant training.view + training.manage to admin; training.view to supervisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN ('training.view','training.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'supervisor' AND p.name = 'training.view'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_bvt    INT;
  v_iso45  INT;
  v_sdl2   INT;
  v_io     INT;
  v_count  INT;
BEGIN
  SELECT id INTO v_bvt   FROM training_types WHERE code = 'BVT';
  SELECT id INTO v_iso45 FROM training_types WHERE code = 'ISO45';
  SELECT id INTO v_sdl2  FROM training_types WHERE code = 'SDL2';
  SELECT id INTO v_io    FROM training_types WHERE code = 'HCVPIO';

  -- ════════════════════════════════════════════════════════════════════════════
  -- BVT — Hazard ID & Risk Assessment / HSE / Accident Investigation
  -- ════════════════════════════════════════════════════════════════════════════

  -- Group A: Jul 15–17, 2024 → expiry 2026-07-17 (due soon)
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_bvt, '2024-07-17', '2026-07-17',
         'Bureau Veritas — Hazard ID & Risk Assessment / HSE'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%kissiedu%')
   OR (s.name ILIKE '%eric%'      AND s.name ILIKE '%wiafe%')
   OR (s.name ILIKE '%augustina%' AND s.name ILIKE '%obeng%')
   OR (s.name ILIKE '%richard%'   AND s.name ILIKE '%ampadu%')
   OR (s.name ILIKE '%winnifred%' AND s.name ILIKE '%yelifari%')
   OR (s.name ILIKE '%seth%'      AND s.name ILIKE '%ampofo%')
   OR (s.name ILIKE '%isaac%'     AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%kwesi%'     AND s.name ILIKE '%ofori%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_bvt
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 BVT Jul 17: % records', v_count;

  -- Group B: Jul 15–30, 2024 → expiry 2026-07-30
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_bvt, '2024-07-30', '2026-07-30',
         'Bureau Veritas — Hazard ID & Risk Assessment / HSE'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%hanniel%'  AND s.name ILIKE '%baidoo%')
   OR (s.name ILIKE '%kwadzi%'   OR  s.name ILIKE '%gameli%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_bvt
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 BVT Jul 30: % records', v_count;

  -- Group C: Aug 12–14, 2024 → expiry 2026-08-14
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_bvt, '2024-08-14', '2026-08-14',
         'Bureau Veritas — Hazard ID & Risk Assessment / HSE'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%jessica%'    AND s.name ILIKE '%budu%')
   OR (s.name ILIKE '%derrick%'    AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%fr%drick%'   AND s.name ILIKE '%ankrah%')
   OR (s.name ILIKE '%carl%'       AND s.name ILIKE '%tsatsu%')
   OR (s.name ILIKE '%dennis%'     AND s.name ILIKE '%gardiner%')
   OR (s.name ILIKE '%kristopher%' AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%nunnin%'     OR  s.name ILIKE '%nunnisu%')
   OR (s.name ILIKE '%desmond%'    AND s.name ILIKE '%akese%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_bvt
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 BVT Aug 14: % records', v_count;

  -- ════════════════════════════════════════════════════════════════════════════
  -- ISO 45001:2018 Internal Auditors Course
  -- ════════════════════════════════════════════════════════════════════════════

  -- Group A: Jul 18–19, 2024 → expiry 2026-07-19
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_iso45, '2024-07-19', '2026-07-19',
         'Bureau Veritas — ISO 45001:2018 Internal Auditors Course'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%kissiedu%')
   OR (s.name ILIKE '%eric%'      AND s.name ILIKE '%wiafe%')
   OR (s.name ILIKE '%augustina%' AND s.name ILIKE '%obeng%')
   OR (s.name ILIKE '%richard%'   AND s.name ILIKE '%ampadu%')
   OR (s.name ILIKE '%winnifred%' AND s.name ILIKE '%yelifari%')
   OR (s.name ILIKE '%seth%'      AND s.name ILIKE '%ampofo%')
   OR (s.name ILIKE '%isaac%'     AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%nii%'       AND s.name ILIKE '%decardi%')
   OR (s.name ILIKE '%kwadzi%'    OR  s.name ILIKE '%gameli%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_iso45
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 ISO45 Jul 19: % records', v_count;

  -- Group B: Aug 15–16, 2024 → expiry 2026-08-16
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_iso45, '2024-08-16', '2026-08-16',
         'Bureau Veritas — ISO 45001:2018 Internal Auditors Course'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%kwesi%'      AND s.name ILIKE '%ofori%')
   OR (s.name ILIKE '%hanniel%'    AND s.name ILIKE '%baidoo%')
   OR (s.name ILIKE '%jessica%'    AND s.name ILIKE '%budu%')
   OR (s.name ILIKE '%derrick%'    AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%fr%drick%'   AND s.name ILIKE '%ankrah%')
   OR (s.name ILIKE '%carl%'       AND s.name ILIKE '%tsatsu%')
   OR (s.name ILIKE '%dennis%'     AND s.name ILIKE '%gardiner%')
   OR (s.name ILIKE '%kristopher%' AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%nunnin%'     OR  s.name ILIKE '%nunnisu%')
   OR (s.name ILIKE '%desmond%'    AND s.name ILIKE '%akese%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_iso45
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 ISO45 Aug 16: % records', v_count;

  -- ════════════════════════════════════════════════════════════════════════════
  -- SDL2 — HCVP Technical Training SL2 | 05/04/2025 → expires 05/04/2027
  -- ════════════════════════════════════════════════════════════════════════════
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_sdl2, '2025-04-05', '2027-04-05',
         'HCVP Technical Training SL2'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND (
      (s.name ILIKE '%carl%'       AND s.name ILIKE '%tsatsu%')
   OR (s.name ILIKE '%dennis%'     AND s.name ILIKE '%gardiner%')
   OR (s.name ILIKE '%derrick%'    AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%emmanuel%'   AND s.name ILIKE '%adjei%')
   OR (s.name ILIKE '%eric%'       AND s.name ILIKE '%mensah%' AND s.name ILIKE '%obrey%')
   OR (s.name ILIKE '%eric%'       AND s.name ILIKE '%obrey%')
   OR (s.name ILIKE '%kwadzi%'     OR  s.name ILIKE '%gameli%')
   OR (s.name ILIKE '%isaac%'      AND s.name ILIKE '%ohene%')
   OR (s.name ILIKE '%kwesi%'      AND s.name ILIKE '%ofori%')
   OR (s.name ILIKE '%nii%'        AND s.name ILIKE '%decardi%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_sdl2
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 SDL2: % records', v_count;

  -- ════════════════════════════════════════════════════════════════════════════
  -- HCVP Image Operator Training (partial — 2 records visible in source)
  -- ════════════════════════════════════════════════════════════════════════════
  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_io, '2025-05-17', '2027-05-17',
         'HCVP Image Operator (IO) Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND s.name ILIKE '%seth%' AND s.name ILIKE '%ampofo%'
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_io
    );

  INSERT INTO staff_training_records
    (staff_id, training_type_id, completion_date, expiry_date, notes)
  SELECT s.id, v_io, '2025-05-14', '2027-05-14',
         'HCVP Image Operator (IO) Training'
  FROM   lms_staff s
  WHERE  s.is_active = TRUE
    AND s.name ILIKE '%bridget%' AND s.name ILIKE '%malik%'
    AND NOT EXISTS (
      SELECT 1 FROM staff_training_records r
      WHERE r.staff_id = s.id AND r.training_type_id = v_io
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '033 HCVPIO: % record(s) inserted (partial list — add remaining via UI)', v_count;

END;
$$;
