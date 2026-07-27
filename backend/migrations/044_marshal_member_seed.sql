-- Migration 044: Add group_type to scan_gang_members and seed full rosters
-- SCAN    → deployed to IMPORTS / EXPORTS areas (15 per gang)
-- INTRUSIVE → deployed to INTRUSIVE area       (13-14 per gang)

-- ── Schema: add group_type ────────────────────────────────────────────────────
ALTER TABLE scan_gang_members
  ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) NOT NULL DEFAULT 'SCAN'
    CHECK (group_type IN ('SCAN', 'INTRUSIVE'));

-- Drop old unique constraint (gang_id, position_no) and replace with
-- (gang_id, group_type, position_no) so pos-1 can exist in both groups
ALTER TABLE scan_gang_members
  DROP CONSTRAINT IF EXISTS scan_gang_members_gang_id_position_no_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_gang_group_position'
  ) THEN
    ALTER TABLE scan_gang_members
      ADD CONSTRAINT uq_gang_group_position UNIQUE (gang_id, group_type, position_no);
  END IF;
END $$;

-- ── Seed members ──────────────────────────────────────────────────────────────
DO $SEED$
DECLARE
  v_bf INT; v_wo INT; v_re INT;
BEGIN
  SELECT id INTO v_bf FROM scan_gangs WHERE code='BF';
  SELECT id INTO v_wo FROM scan_gangs WHERE code='WO';
  SELECT id INTO v_re FROM scan_gangs WHERE code='RE';

  IF v_bf IS NULL OR v_wo IS NULL OR v_re IS NULL THEN
    RAISE EXCEPTION 'scan_gangs not seeded — run migration 043 first.';
  END IF;

  -- ── BLUE FALCON — SCAN MARSHALS (15) ────────────────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_bf, 'EMMANUEL DONKOR',       1,  'headman', 'SCAN'),
    (v_bf, 'BENEDICT ANAMAN',       2,  'marshal', 'SCAN'),
    (v_bf, 'EVANS ADRI',            3,  'marshal', 'SCAN'),
    (v_bf, 'PHILIP FIANKO',         4,  'marshal', 'SCAN'),
    (v_bf, 'ISAAC AGBESHIE',        5,  'marshal', 'SCAN'),
    (v_bf, 'EMMANUEL LARTEY',       6,  'marshal', 'SCAN'),
    (v_bf, 'EMMANUEL SEGLA',        7,  'marshal', 'SCAN'),
    (v_bf, 'PROMISE KUDJORDZI',     8,  'marshal', 'SCAN'),
    (v_bf, 'GABRIEL ASHITEY ARMAH', 9,  'marshal', 'SCAN'),
    (v_bf, 'ERIC NANA MARFO',       10, 'marshal', 'SCAN'),
    (v_bf, 'MATTHEW MAKINYE',       11, 'marshal', 'SCAN'),
    (v_bf, 'EZEKIEL WHITE',         12, 'marshal', 'SCAN'),
    (v_bf, 'GERTRUDE OFORIWAA',     13, 'marshal', 'SCAN'),
    (v_bf, 'EMMANUEL OSEI BOMSU',   14, 'marshal', 'SCAN'),
    (v_bf, 'SETH KOFI AIDOO',       15, 'marshal', 'SCAN')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  -- ── WHITE OX — SCAN MARSHALS (15) ───────────────────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_wo, 'EMMANUEL ADJETEY ADJEI', 1,  'headman', 'SCAN'),
    (v_wo, 'MICHAEL AYITEY ANNANG',  2,  'marshal', 'SCAN'),
    (v_wo, 'ISAAC TWUMASI',          3,  'marshal', 'SCAN'),
    (v_wo, 'PRINCE QUANSAH',         4,  'marshal', 'SCAN'),
    (v_wo, 'AMAZING MENSAH',         5,  'marshal', 'SCAN'),
    (v_wo, 'HARRISON AGO ANNANG',    6,  'marshal', 'SCAN'),
    (v_wo, 'DENNIS MANTEY QUAYE',    7,  'marshal', 'SCAN'),
    (v_wo, 'BAMFO BOATENG',          8,  'marshal', 'SCAN'),
    (v_wo, 'SOLOMON FANKIBI',        9,  'marshal', 'SCAN'),
    (v_wo, 'PRINCE MANTEY KODIE',    10, 'marshal', 'SCAN'),
    (v_wo, 'RICHARD ANNANG',         11, 'marshal', 'SCAN'),
    (v_wo, 'FELIX ATTENANG',         12, 'marshal', 'SCAN'),
    (v_wo, 'EDEM AMADUME',           13, 'marshal', 'SCAN'),
    (v_wo, 'SAFIA IBRAHIM',          14, 'marshal', 'SCAN'),
    (v_wo, 'EMMANUEL ESSUON',        15, 'marshal', 'SCAN')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  -- ── RED EAGLE — SCAN MARSHALS (15) ──────────────────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_re, 'CHARLES OSEI MANU',    1,  'headman', 'SCAN'),
    (v_re, 'PRINCE BONYI',         2,  'marshal', 'SCAN'),
    (v_re, 'EVANS ADJEI ADJETEY',  3,  'marshal', 'SCAN'),
    (v_re, 'JEREMIAH ADJETEY',     4,  'marshal', 'SCAN'),
    (v_re, 'DERRICK OBUADEY',      5,  'marshal', 'SCAN'),
    (v_re, 'WISDOM AFRAM',         6,  'marshal', 'SCAN'),
    (v_re, 'YAW DOE',              7,  'marshal', 'SCAN'),
    (v_re, 'GEORGE OWUSU',         8,  'marshal', 'SCAN'),
    (v_re, 'PROMISE SENYEGAH',     9,  'marshal', 'SCAN'),
    (v_re, 'GARIBA ABUDULAI',      10, 'marshal', 'SCAN'),
    (v_re, 'PERRY OKINE',          11, 'marshal', 'SCAN'),
    (v_re, 'OBED KUDJOE',          12, 'marshal', 'SCAN'),
    (v_re, 'PRINCE ANIM',          13, 'marshal', 'SCAN'),
    (v_re, 'ANGELA NYAVOR',        14, 'marshal', 'SCAN'),
    (v_re, 'DAVID OSEI OWUSU',     15, 'marshal', 'SCAN')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  -- ── BLUE FALCON — INTRUSIVE (13) ────────────────────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_bf, 'BRIGHT ZILEVU',          1,  'foreman', 'INTRUSIVE'),
    (v_bf, 'SILVIA DUGBATEY',        2,  'marshal', 'INTRUSIVE'),
    (v_bf, 'SAMUEL KWAME GYENTY',    3,  'marshal', 'INTRUSIVE'),
    (v_bf, 'MAXWELL ABEKAH',         4,  'marshal', 'INTRUSIVE'),
    (v_bf, 'FELIX ADDO',             5,  'marshal', 'INTRUSIVE'),
    (v_bf, 'OPELIA AMAKYE',          6,  'marshal', 'INTRUSIVE'),
    (v_bf, 'JULIEN KOTEYE',          7,  'marshal', 'INTRUSIVE'),
    (v_bf, 'EUNICE QUAYSON',         8,  'marshal', 'INTRUSIVE'),
    (v_bf, 'GIFTY AMOAKOWAA DARKO',  9,  'marshal', 'INTRUSIVE'),
    (v_bf, 'TITUS ADJEI',            10, 'marshal', 'INTRUSIVE'),
    (v_bf, 'SAMUEL MENSAH',          11, 'marshal', 'INTRUSIVE'),
    (v_bf, 'ALFRED K AGBO',          12, 'marshal', 'INTRUSIVE'),
    (v_bf, 'MATTHEW KOBINA',         13, 'marshal', 'INTRUSIVE')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  -- ── WHITE OX — INTRUSIVE (14 incl. Philip Akutu) ────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_wo, 'MATTHEW OPPONG',    1,  'headman', 'INTRUSIVE'),
    (v_wo, 'LOUISA APPIAH',     2,  'marshal', 'INTRUSIVE'),
    (v_wo, 'STEPHEN OKOE ADDO', 3,  'marshal', 'INTRUSIVE'),
    (v_wo, 'ENOCH LOMOTEY',     4,  'marshal', 'INTRUSIVE'),
    (v_wo, 'CLARA ATIAH',       5,  'marshal', 'INTRUSIVE'),
    (v_wo, 'SUNDAY AZURE',      6,  'marshal', 'INTRUSIVE'),
    (v_wo, 'LAWRENCIA ASAMOAH', 7,  'marshal', 'INTRUSIVE'),
    (v_wo, 'BENEDICTA ANUM',    8,  'marshal', 'INTRUSIVE'),
    (v_wo, 'VICTOR BARNES',     9,  'marshal', 'INTRUSIVE'),
    (v_wo, 'JESSICA SETU',      10, 'marshal', 'INTRUSIVE'),
    (v_wo, 'EMMANUEL ADU',      11, 'marshal', 'INTRUSIVE'),
    (v_wo, 'RICHARD OTENG',     12, 'marshal', 'INTRUSIVE'),
    (v_wo, 'ABIBA MOHAMED',     13, 'marshal', 'INTRUSIVE'),
    (v_wo, 'PHILIP AKUTU',      14, 'marshal', 'INTRUSIVE')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  -- ── RED EAGLE — INTRUSIVE (14) ───────────────────────────────────────────────
  INSERT INTO scan_gang_members (gang_id, full_name, position_no, role, group_type) VALUES
    (v_re, 'JOEL QUASHIE',        1,  'headman', 'INTRUSIVE'),
    (v_re, 'IRENE OKUTU',         2,  'marshal', 'INTRUSIVE'),
    (v_re, 'SOLOMON BOAKO',       3,  'marshal', 'INTRUSIVE'),
    (v_re, 'ROSE OFORI',          4,  'marshal', 'INTRUSIVE'),
    (v_re, 'FIRDAUS OSMAN',       5,  'marshal', 'INTRUSIVE'),
    (v_re, 'ERIC AFORKPA',        6,  'marshal', 'INTRUSIVE'),
    (v_re, 'SAMPSON ASAMOAH',     7,  'marshal', 'INTRUSIVE'),
    (v_re, 'THERESA OCHERE',      8,  'marshal', 'INTRUSIVE'),
    (v_re, 'GODWIN G KWADZI',     9,  'marshal', 'INTRUSIVE'),
    (v_re, 'CHRISTINA KANU',      10, 'marshal', 'INTRUSIVE'),
    (v_re, 'DANIEL OWUSU ADDAE',  11, 'marshal', 'INTRUSIVE'),
    (v_re, 'EDMUND ADDO',         12, 'marshal', 'INTRUSIVE'),
    (v_re, 'EMMANUEL AKPLAGA',    13, 'marshal', 'INTRUSIVE'),
    (v_re, 'GIDEON LARTEY',       14, 'marshal', 'INTRUSIVE')
  ON CONFLICT (gang_id, group_type, position_no) DO NOTHING;

  RAISE NOTICE 'Marshal rosters seeded: 45 SCAN + 41 INTRUSIVE members.';
END;
$SEED$;
