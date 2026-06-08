-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024: June 2026 Roster Update
-- Applies all team transfers, promotions, departures and new additions
-- from the Final Roster June 2026 PDF.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Team 2 ↔ Intrusive Team B swap ──────────────────────────────────────────
-- Stacey Naa Adjeley Adjei: Intrusive Team B → Scanning Team 2
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 2')
WHERE name = 'Stacey Naa Adjeley Adjei' AND is_active = TRUE;

-- Stephanie Ackah Blay: Scanning Team 2 → Intrusive Team B
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team B')
WHERE name = 'Stephanie Ackah Blay' AND is_active = TRUE;

-- ── Team 3 ↔ Intrusive Team A swap ──────────────────────────────────────────
-- Nathaniel Codjoe: Intrusive Team A → Scanning Team 3
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 3')
WHERE name = 'Nathaniel Codjoe' AND is_active = TRUE;

-- Emmanuel Ackah: Scanning Team 3 → Intrusive Team A
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team A')
WHERE name = 'Emmanuel Ackah' AND is_active = TRUE;

-- ── Scanning Team 4 changes ──────────────────────────────────────────────────
-- Linda Otwey departed (deactivate)
UPDATE lms_staff SET is_active = FALSE WHERE name = 'Linda Otwey';

-- Frederick Ankrah promoted to Supervisor (was staff)
UPDATE lms_staff
SET role = 'supervisor', annual_entitlement = 21
WHERE name = 'Frederick Ankrah' AND is_active = TRUE;

-- Edwina Aku Addo: Scanning Team 4 → Intrusive Team A
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team A')
WHERE name = 'Edwina Aku Addo' AND is_active = TRUE;

-- Lilian Osei: Scanning Team 4 → Intrusive Team D
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team D')
WHERE name = 'Lilian Osei' AND is_active = TRUE;

-- Pius Duvor: Scanning Team 4 → Intrusive Team D
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team D')
WHERE name = 'Pius Duvor' AND is_active = TRUE;

-- Abdul-Malik Osumanu, Bismack Acheampong, Joshua Okpoti: Intrusive Team D → Scanning Team 4
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 4')
WHERE name IN ('Abdul-Malik Osumanu', 'Bismack Acheampong', 'Joshua Okpoti') AND is_active = TRUE;

-- ── Scanning Team 5 ↔ Intrusive Team C swaps ────────────────────────────────
-- Salome Sinnia Gaayuoni: not in June roster (deactivate)
UPDATE lms_staff SET is_active = FALSE WHERE name = 'Salome Sinnia Gaayuoni';

-- Justina S. Fosu: Scanning Team 5 → Intrusive Team C
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team C')
WHERE name = 'Justina S. Fosu' AND is_active = TRUE;

-- Kwabena Akosa: Intrusive Team C → Scanning Team 5
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 5')
WHERE name = 'Kwabena Akosa' AND is_active = TRUE;

-- Florence Kapre: Intrusive Team C → Scanning Team 5
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 5')
WHERE name = 'Florence Kapre' AND is_active = TRUE;

-- ── Scanning Team 6 changes ──────────────────────────────────────────────────
-- Mary Abalo: Scanning Team 6 → Scanning Team 8, promoted to Supervisor
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 8'),
    role = 'supervisor',
    annual_entitlement = 21
WHERE name = 'Mary Abalo' AND is_active = TRUE;

-- Andrew Nsowah: Scanning Team 6 → Intrusive Team B
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team B')
WHERE name = 'Andrew Nsowah' AND is_active = TRUE;

-- Briana Ayittah: Scanning Team 6 → Intrusive Team B
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team B')
WHERE name = 'Briana Ayittah' AND is_active = TRUE;

-- Saajida Osman Kasanga: Intrusive Team B → Scanning Team 6
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 6')
WHERE name = 'Saajida Osman Kasanga' AND is_active = TRUE;

-- Juliana Affum: Intrusive Team B → Scanning Team 6
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 6')
WHERE name = 'Juliana Affum' AND is_active = TRUE;

-- Ouedraogo Peter Anthony: Intrusive Team A → Scanning Team 6
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 6')
WHERE name = 'Ouedraogo Peter Anthony' AND is_active = TRUE;

-- ── Scanning Team 7 ↔ Intrusive Team A swaps ────────────────────────────────
-- Abdul-Rahman Imran: Scanning Team 7 → Intrusive Team A
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team A')
WHERE name = 'Abdul-Rahman Imran' AND is_active = TRUE;

-- Don Annan: Scanning Team 7 → Intrusive Team A
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team A')
WHERE name = 'Don Annan' AND is_active = TRUE;

-- Bright Nyadzro: Intrusive Team A → Scanning Team 7
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 7')
WHERE name = 'Bright Nyadzro' AND is_active = TRUE;

-- Angela Dufie Agyemang: Intrusive Team A → Scanning Team 7
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Scanning Team 7')
WHERE name = 'Angela Dufie Agyemang' AND is_active = TRUE;

-- ── Scanning Team 8 changes ──────────────────────────────────────────────────
-- Kamaldeen Salifu: Scanning Team 8 → Intrusive Team D
UPDATE lms_staff
SET team_id = (SELECT id FROM lms_teams WHERE name = 'Intrusive Team D')
WHERE name = 'Kamaldeen Salifu' AND is_active = TRUE;

-- ── Intrusive Team D leadership change ──────────────────────────────────────
-- Prince Obiri departed (deactivate)
UPDATE lms_staff SET is_active = FALSE WHERE name = 'Prince Obiri';

-- Samuel Baah-Borquaye: new M Spvr, Intrusive Team D
INSERT INTO lms_staff (team_id, name, role, annual_entitlement)
SELECT t.id, 'Samuel Baah-Borquaye', 'm_supervisor', 21
FROM lms_teams t WHERE t.name = 'Intrusive Team D'
ON CONFLICT DO NOTHING;

-- ── Intrusive Teams A–D: correct supervisor roles ───────────────────────────
-- Team A–C supervisors were stored as 'supervisor' in seed but are labeled
-- (M Spvr) in the roster document. Update to m_supervisor for consistency.
-- Both roles carry 21-day entitlement so leave balances are unaffected.
UPDATE lms_staff
SET role = 'm_supervisor', annual_entitlement = 21
WHERE name IN ('Anthony Blay', 'Wisdom Zikpi', 'Francis Videy')
  AND is_active = TRUE;
