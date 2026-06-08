-- ============================================================================
-- Migration 010 — Seed Scanner & Accelerator Registry (initial data)
-- Source: Current Status table (6 Siemens fixed accelerator scanners)
-- ============================================================================

DO $$
DECLARE
  v_admin_id UUID;

  s2660 UUID; s2661 UUID; s2662 UUID;
  s2663 UUID; s2664 UUID; s2669 UUID;
BEGIN

  -- Get admin user id
  SELECT u.id INTO v_admin_id
  FROM users u JOIN roles r ON r.id = u.role_id
  WHERE r.name = 'admin' ORDER BY u.created_at LIMIT 1;

  -- ── Insert scanners ────────────────────────────────────────────────────────
  INSERT INTO compliance_scanners
    (scanner_serial, accelerator_serial, manufacturer, model, type,
     location, location_code, operational_status, date_commissioned, created_by)
  VALUES
    ('2660', '10025', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-01', 'active', '2020-01-01', v_admin_id),
    ('2661', '10030', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-02', 'active', '2020-01-01', v_admin_id),
    ('2662', '10029', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-03', 'active', '2020-01-01', v_admin_id),
    ('2663', '10022', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-04', 'active', '2020-01-01', v_admin_id),
    ('2664', '10035', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-05', 'active', '2020-01-01', v_admin_id),
    ('2669', '10031', 'Siemens', 'Accelerator Scanner', 'fixed',
     'Port Terminal', 'SCAN-06', 'active', '2020-01-01', v_admin_id)
  ON CONFLICT (scanner_serial) DO NOTHING;

  -- Get each scanner id
  SELECT id INTO s2660 FROM compliance_scanners WHERE scanner_serial = '2660';
  SELECT id INTO s2661 FROM compliance_scanners WHERE scanner_serial = '2661';
  SELECT id INTO s2662 FROM compliance_scanners WHERE scanner_serial = '2662';
  SELECT id INTO s2663 FROM compliance_scanners WHERE scanner_serial = '2663';
  SELECT id INTO s2664 FROM compliance_scanners WHERE scanner_serial = '2664';
  SELECT id INTO s2669 FROM compliance_scanners WHERE scanner_serial = '2669';

  -- ── Scanner 2660 — Inspection completed, awaiting certificate ──────────────
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, is_current, notes, created_by)
  VALUES
    (s2660, 'renewal', 'pending',
     '2026-03-26', TRUE,
     'Inspection completed 26.03.2026. Certificate not yet issued — awaiting NRA issuance.',
     v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Scanner 2661 — Certificate issued, expiry 10.03.2027 ──────────────────
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, certificate_expiry_date,
     is_current, created_by)
  VALUES
    (s2661, 'renewal', 'issued',
     '2026-01-29', '2027-03-10',
     TRUE, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Scanner 2662 — Certificate issued, expiry 10.03.2027 ──────────────────
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, certificate_expiry_date,
     is_current, created_by)
  VALUES
    (s2662, 'renewal', 'issued',
     '2026-01-29', '2027-03-10',
     TRUE, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Scanner 2663 — Certificate issued, expiry 10.03.2027 ──────────────────
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, certificate_expiry_date,
     is_current, created_by)
  VALUES
    (s2663, 'renewal', 'issued',
     '2026-01-29', '2027-03-10',
     TRUE, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Scanner 2664 — Certificate issued, expiry 10.03.2027 ──────────────────
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, certificate_expiry_date,
     is_current, created_by)
  VALUES
    (s2664, 'renewal', 'issued',
     '2026-01-29', '2027-03-10',
     TRUE, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Scanner 2669 — Certificate issued, expiry 20.10.2026 ──────────────────
  -- Application deadline auto-calculated by trigger: 20.06.2026
  -- This certificate expires soonest — should already be flagged
  INSERT INTO compliance_certificates
    (scanner_id, certificate_type, certification_status,
     last_inspection_date, certificate_expiry_date,
     is_current, created_by)
  VALUES
    (s2669, 'renewal', 'issued',
     '2025-09-03', '2026-10-20',
     TRUE, v_admin_id)
  ON CONFLICT DO NOTHING;

END $$;

-- Verify
SELECT s.scanner_serial, s.accelerator_serial,
       c.certification_status,
       c.last_inspection_date,
       c.certificate_expiry_date,
       c.application_deadline,
       (c.certificate_expiry_date - CURRENT_DATE) AS days_until_expiry
FROM compliance_scanners s
LEFT JOIN compliance_certificates c ON c.scanner_id = s.id AND c.is_current = TRUE
ORDER BY s.scanner_serial;
