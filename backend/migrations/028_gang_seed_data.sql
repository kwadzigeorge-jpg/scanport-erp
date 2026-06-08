-- Migration 028: Seed initial gang roster (22 gangs + Group A & Group B)
-- Safe to re-run: ON CONFLICT DO NOTHING on both tables.

-- ── Insert gangs ──────────────────────────────────────────────────────────────
INSERT INTO gangs (gang_code, status, performance_score, total_jobs_completed)
VALUES
  ('GANG 1',  'available', 100.00, 0),
  ('GANG 2',  'available', 100.00, 0),
  ('GANG 3',  'available', 100.00, 0),
  ('GANG 4',  'available', 100.00, 0),
  ('GANG 5',  'available', 100.00, 0),
  ('GANG 6',  'available', 100.00, 0),
  ('GANG 7',  'available', 100.00, 0),
  ('GANG 8',  'available', 100.00, 0),
  ('GANG 9',  'available', 100.00, 0),
  ('GANG 10', 'available', 100.00, 0),
  ('GANG 11', 'available', 100.00, 0),
  ('GANG 12', 'available', 100.00, 0),
  ('GANG 13', 'available', 100.00, 0),
  ('GANG 14', 'available', 100.00, 0),
  ('GANG 15', 'available', 100.00, 0),
  ('GANG 16', 'available', 100.00, 0),
  ('GANG 17', 'available', 100.00, 0),
  ('GANG 18', 'available', 100.00, 0),
  ('GANG 19', 'available', 100.00, 0),
  ('GANG 20', 'available', 100.00, 0),
  ('GANG 21', 'available', 100.00, 0),
  ('GANG 22', 'available', 100.00, 0),
  ('GROUP A', 'available', 100.00, 0),
  ('GROUP B', 'available', 100.00, 0)
ON CONFLICT (gang_code) DO NOTHING;

-- Mark reserve pools so the allocation engine excludes them from recommendations
UPDATE gangs
SET specialization = 'Reserve Pool',
    notes = 'Replacement members for absent regular gang workers'
WHERE gang_code IN ('GROUP A', 'GROUP B')
  AND specialization IS NULL;

-- ── Helper: insert member by gang_code ────────────────────────────────────────
-- Each row: SELECT gang_id from gangs then insert member.
-- ON CONFLICT (employee_id) DO NOTHING makes this idempotent.

-- GANG 1
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'OSEI KOFI',        'G01-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 1' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'FRANCIS SHAMO',    'G01-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 1' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'NATHANIEL MENSAH', 'G01-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 1' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JAMES ADDAE',      'G01-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 1' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'BEN BANINI',       'G01-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 1' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 2
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'VINCENT MENSAH',     'G02-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 2' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ANTHONY ENOO DANSO', 'G02-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 2' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ISAAC BADU',         'G02-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 2' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'RICHMOND ODEI',      'G02-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 2' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ALBERT AMEDOR',      'G02-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 2' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 3
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'ERIC FUMADOR',      'G03-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 3' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH ANNIE',      'G03-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 3' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SETH ABBAM',        'G03-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 3' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ISAAC KOFI MENSAH', 'G03-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 3' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH NYARKO',     'G03-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 3' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 4
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'HENRY DJABA',           'G04-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 4' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'DAVID AMEVI OGBORDJOR', 'G04-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 4' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'YAHAYA MOHAMMED',       'G04-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 4' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MICHAEL ARTHUR',        'G04-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 4' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'FOSTER AZANDA',         'G04-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 4' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 5
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'SAMPSON QUARSHIE',     'G05-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 5' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EMMANUEL BLIKO',       'G05-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 5' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'FELIX DAKUDJI',        'G05-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 5' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SAMUEL ADAMS ESHUN',   'G05-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 5' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'KELVIN S. K. AGBODJI', 'G05-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 5' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 6
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'EMMANUEL OPARE', 'G06-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 6' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH ARTHUR',  'G06-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 6' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MICHAEL ADDAE',  'G06-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 6' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JAMES ARTHUR',   'G06-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 6' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ERIC BAAH',      'G06-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 6' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 7
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'SOLOMON CUDJOE', 'G07-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 7' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'GEORGE SOLLEY',  'G07-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 7' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'KWESI ABBAN',    'G07-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 7' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH ODAI',    'G07-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 7' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'AARON ASHITEY',  'G07-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 7' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 8
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'THOMAS SANKAH',    'G08-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 8' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'HUADJIE AKWETEY',  'G08-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 8' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOE STEVE BAFFOE', 'G08-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 8' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SIMON TETTEH',     'G08-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 8' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SAMUEL BORTEY',    'G08-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 8' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 9
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'EBENEZER ADJEI',   'G09-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 9' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'DENNIS KUGBADJOR', 'G09-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 9' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'GIDEON NYARKO',    'G09-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 9' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'STEPHEN YAWSON',   'G09-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 9' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JULIUS NUETEY',    'G09-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 9' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 10
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'KENNEDY TETTEYFIO', 'G10-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 10' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'KWEKU AMFOH',       'G10-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 10' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'DANIEL AKPENG',     'G10-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 10' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'KASSIM FIRDAUS',    'G10-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 10' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'NICK ERIC ACQUAYE', 'G10-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 10' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 11
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'SIMON AKLORBORTU', 'G11-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 11' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ERIC ANDOH',       'G11-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 11' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EMMANUEL OKYERE',  'G11-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 11' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MICHAEL AMANKWAH', 'G11-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 11' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'GERALD TETTEH',    'G11-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 11' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 12
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'GODFRED AMASSAH',       'G12-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 12' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ISAAC ACHEAMPONG',      'G12-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 12' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EBENEZER ADJEI MENSAH', 'G12-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 12' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ORESTICS ODURO',        'G12-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 12' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MESHACK ENU',           'G12-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 12' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 13
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'JONATHAN SOSU',      'G13-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 13' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'AMADU ABDUL RAHMAN', 'G13-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 13' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSHUA TETTEH',      'G13-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 13' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SETH AKUTEY',        'G13-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 13' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SYLVANUS AGBEVE',    'G13-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 13' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 14
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'BONIFACE YOURKUU', 'G14-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 14' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MAXWELL ARHINFUL', 'G14-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 14' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ERNEST SMITH',     'G14-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 14' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MARCUS OFORI',     'G14-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 14' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'GODSON FIANU',     'G14-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 14' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 15
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'EBENEZER NEEQUAYE', 'G15-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 15' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SAMUEL ADDO',       'G15-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 15' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SOLOMON OPATA',     'G15-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 15' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ROBERT OWUSU',      'G15-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 15' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SELORM AGBO',       'G15-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 15' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 16
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'ISSAKA MOHAMMED',      'G16-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 16' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'HENRY OKO BORTEY',     'G16-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 16' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'FRANCIS KWAKU YEBOAH', 'G16-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 16' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'GEORGE K. FRIMPONG',   'G16-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 16' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOHN KONADU',          'G16-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 16' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 17
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'NANA TUFFOUR',    'G17-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 17' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EMMANUEL DADZIE', 'G17-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 17' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'HARRY MENSAH',    'G17-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 17' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'STEPHEN OCANSEY', 'G17-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 17' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOHN GHARTEY',    'G17-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 17' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 18
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'GABRIEL AKUTEY',    'G18-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 18' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'DAVID BROWN',       'G18-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 18' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'CLEMENT KORANTENG', 'G18-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 18' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EMMANUEL ANNANG',   'G18-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 18' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MATTHIAS BONNAH',   'G18-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 18' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 19
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'IBRAHIM BABA',   'G19-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 19' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EMMANUEL ANTOH', 'G19-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 19' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ISSAC AFFUL',    'G19-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 19' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'DANIEL AGBO',    'G19-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 19' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ASARE ABBEY',    'G19-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 19' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 20
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'CEPHAS SOBO',            'G20-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 20' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH DADZIE',          'G20-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 20' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'MICHAEL DENFUL',         'G20-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 20' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'ISAIAH BORKETEY',        'G20-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 20' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SIMON BORKETEY ADJANAI', 'G20-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 20' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 21
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'PAUL MENSAH',     'G21-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 21' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOSEPH K. AMPAH', 'G21-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 21' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'JOHN AIDOO',      'G21-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 21' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SETH OWUSU',      'G21-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 21' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'FELIX ABROKWAH',  'G21-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 21' ON CONFLICT (employee_id) DO NOTHING;

-- GANG 22
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'head_man', 'EMMANUEL ADJEI',  'G22-HM', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 22' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'EDWARD MENSAH',   'G22-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 22' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'STEPHEN NTSIFUL', 'G22-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 22' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'SAMUEL ANIM',     'G22-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 22' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker',   'BENJAMIN ANTWI',  'G22-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GANG 22' ON CONFLICT (employee_id) DO NOTHING;

-- GROUP A (reserve pool — no head man)
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'ERIC KWASI AZANDO',    'GA-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP A' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'KORLEY LORD',           'GA-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP A' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'GIDEON ADJEI LARYEA',  'GA-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP A' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'EMMANUEL K. GYAMPSON', 'GA-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP A' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'JUDE EYISON',          'GA-D5', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP A' ON CONFLICT (employee_id) DO NOTHING;

-- GROUP B (reserve pool — no head man)
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'PRAH YAWSON',          'GB-D1', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP B' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'BENEDICT LETSA',       'GB-D2', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP B' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'REINDOLF AFOTEY OTOO', 'GB-D3', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP B' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'DENNIS KWOFIE',        'GB-D4', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP B' ON CONFLICT (employee_id) DO NOTHING;
INSERT INTO gang_members (gang_id, role, full_name, employee_id, is_active, status)
SELECT id, 'docker', 'HENRY ADJEI NUBOUR',   'GB-D5', TRUE, 'available' FROM gangs WHERE gang_code = 'GROUP B' ON CONFLICT (employee_id) DO NOTHING;
