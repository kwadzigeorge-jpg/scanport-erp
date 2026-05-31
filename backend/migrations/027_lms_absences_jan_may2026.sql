-- Absence records extracted from WhatsApp Absence Reporting Group chat
-- Period: 1 January 2026 – 31 May 2026
-- Run ONCE. Each INSERT uses NOT EXISTS to prevent duplicates on re-run.

-- ── January 2026 ──────────────────────────────────────────────────────────────

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-02','2026-01-02',1,'no_reason','Did not report to work — no reason given','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Abdul-Rahman Imran%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-11','2026-01-11',1,'sick','Runny tummy — called in sick','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Evelyn Ashitey%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-11') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-27','2026-01-27',1,'family_emergency','Family emergency','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Asah-Opoku%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-27') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-27','2026-01-27',1,'no_reason','Called to say coming late but never reported — efforts to reach her failed','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Elsie Ankrah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-27') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-28','2026-01-28',1,'no_reason','Absent from work — no reason given','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Emmanuel Ackah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-28') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-29','2026-01-29',1,'no_reason','Absent from work — no reason given','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Elsie Ankrah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-29') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-30','2026-01-30',1,'sick','Still in recovery — absence extended; excuse duty already submitted via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Bismack Acheampong%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-30') LIMIT 1;

-- ── February 2026 ─────────────────────────────────────────────────────────────

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-01','2026-02-01',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Alhassan Faisal%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-01') LIMIT 1;

-- "did not report yesterday and today" reported on 1 Feb → 31 Jan–1 Feb
INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-01-31','2026-02-01',2,'sick','Unwell — absent 31 Jan and 1 Feb; excuse duty to be provided','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Pius Duvor%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-01-31') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-02','2026-02-02',1,'family_emergency','Family emergency','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Enoch Adjei Agyapong%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-03','2026-02-03',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Florence Kapre%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-03') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-03','2026-02-04',2,'sick','Unwell — today and tomorrow; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%George Sunday Namba%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-03') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-07','2026-02-08',2,'sick','Unwell — two days; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Alhassan Faisal%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-07') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-10','2026-02-11',2,'family_emergency','Family emergency — next two days','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Fiawoyife%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-10') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-12','2026-02-13',2,'sick','Unwell — today and tomorrow; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Amanda Mensah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-12') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-12','2026-02-12',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Dorcas Gaayuoni%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-12') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-13','2026-02-13',1,'family_emergency','Family emergency — rest of the shift','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Fiawoyife%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-13') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-16','2026-02-16',1,'no_reason','Did not report to work — reason unknown','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Andrew Nsowah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-16') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-18','2026-02-18',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-18') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-23','2026-02-25',3,'sick','Unwell — next 3 days; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-23') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-23','2026-02-23',1,'family_emergency','Family emergency — this shift','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Grant Albert Asiakwa%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-23') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-25','2026-02-25',1,'family_emergency','Emergency — unable to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Sahanun%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-25') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-27','2026-02-27',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ampaabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-27') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-28','2026-02-28',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ampaabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-28') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-02-28','2026-02-28',1,'no_reason','Will not be able to report to work — no reason given','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Emmanuel Ackah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-02-28') LIMIT 1;

-- ── March 2026 ────────────────────────────────────────────────────────────────

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-01','2026-03-02',2,'sick','Unwell — today and tomorrow; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ampaabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-01') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-04','2026-03-04',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Talent Abalo%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-04') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-07','2026-03-07',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Evelyn Ashitey%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-07') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-07','2026-03-08',2,'family_emergency','Family emergency — tonight and tomorrow','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Francis Essel%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-07') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-09','2026-03-09',1,'sick','Doctor''s appointment — did not report for night shift','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nafisah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-09') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-13','2026-03-13',1,'family_emergency','Emergency — unable to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Sahanun%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-13') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-14','2026-03-14',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Sarah Adjabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-14') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-15','2026-03-15',1,'sick','Unwell — cannot report to work this morning','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Don Annan%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-15') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-20','2026-03-20',1,'family_emergency','Emergency — unable to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Sahanun%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-20') LIMIT 1;

-- 21–24 Mar: 4 days confirmed by HR payroll deduction notice on 25 Mar
INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-21','2026-03-24',4,'sick','Unwell — 4 days; HR confirmed for payroll on 25 Mar; excuse duty via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-21') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-28','2026-03-28',1,'sick','Still hospitalised — spoke with her this evening; excuse duty sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-28') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-29','2026-03-29',1,'other','Unable to report — flooding in house/neighbourhood','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ouedraogo%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-29') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-31','2026-03-31',1,'no_reason','No further information given — said she had informed the intrusive manager','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nafisah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-31') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-03-31','2026-03-31',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Kwabena Akosa%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-03-31') LIMIT 1;

-- ── April 2026 ────────────────────────────────────────────────────────────────

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-02','2026-04-02',1,'family_emergency','Family emergency','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Abdul-Rahman Imran%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-02','2026-04-02',1,'no_reason','Will not be able to report to work — no reason given','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nafisah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-04','2026-04-05',2,'family_emergency','Emergency — today and tomorrow','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Enoch Adjei Agyapong%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-04') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-04','2026-04-04',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-04') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-08','2026-04-08',1,'sick','Unwell — will not report tonight','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nathaniel Co%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-08') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-09','2026-04-09',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nathaniel Co%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-09') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-10','2026-04-11',2,'sick','Unwell — today and tomorrow; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Augustina Obeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-10') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-12','2026-04-12',1,'sick','Unwell — unable to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ouedraogo%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-12') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-12','2026-04-12',1,'sick','Unwell — unable to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-12') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-20','2026-04-20',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Joshua Okpoti%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-20') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-20','2026-04-20',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lilian Osei%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-20') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-24','2026-04-24',1,'family_emergency','Emergency — will not be able to report to work today','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Aviella%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-24') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-25','2026-04-25',1,'sick','Unwell — rest of shift; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Angela%Agyemang%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-25') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-25','2026-04-26',2,'sick','Unwell — 25 & 26 Apr; excuse duty sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Amanda Mensah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-25') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-04-27','2026-04-27',1,'family_emergency','Emergency — will not be able to report to work today','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Dorcas Gaayuoni%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-04-27') LIMIT 1;

-- ── May 2026 ──────────────────────────────────────────────────────────────────

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-01','2026-05-01',1,'family_emergency','Emergency — will not report tonight','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Enoch Adjei Agyapong%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-01') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-01','2026-05-01',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Mary Abalo%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-01') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-02','2026-05-03',2,'family_emergency','Emergency — today and tomorrow','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Francis Essel%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-02','2026-05-02',1,'family_emergency','Emergency — couldn''t come to work tonight','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Linda Debrah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-02') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-03','2026-05-03',1,'family_emergency','Emergency — will not be able to report to work today','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Bright Nyadzro%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-03') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-03','2026-05-03',1,'no_reason','Has not reported to work — no reason communicated','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Emmanuel Ackah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-03') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-04','2026-05-04',1,'family_emergency','Emergency — will not be able to report to work today','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Amoako%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-04') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-10','2026-05-10',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Paul Essien%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-10') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-10','2026-05-10',1,'family_emergency','Emergency — will not be able to report to work today','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ampaabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-10') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-10','2026-05-10',1,'family_emergency','Emergency — will not be able to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Angela%Agyemang%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-10') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-15','2026-05-15',1,'family_emergency','Emergency — will not be able to report to work this evening','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Lily Ofosua%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-15') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-24','2026-05-24',1,'sick','Unwell — excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Abdul-Malik%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-24') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-26','2026-05-26',1,'family_emergency','Emergency — will not be able to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Nafisah%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-26') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-27','2026-05-27',1,'family_emergency','Emergency — will not be able to report to work','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Ampaabeng%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-27') LIMIT 1;

INSERT INTO lms_absences (staff_id,start_date,end_date,days,reason,notes,logged_by)
SELECT s.id,'2026-05-30','2026-05-31',2,'sick','Unwell — today and tomorrow; excuse duty to be sent via email','WhatsApp Import'
FROM lms_staff s WHERE s.name ILIKE '%Mary Abalo%' AND s.is_active=TRUE
  AND NOT EXISTS(SELECT 1 FROM lms_absences WHERE staff_id=s.id AND start_date='2026-05-30') LIMIT 1;
