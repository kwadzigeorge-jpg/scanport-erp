const db   = require('../config/database');
const path = require('path');
const fs   = require('fs');
const XLSX = require('xlsx');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function paginate(page, limit) {
  const p = Math.max(1, parseInt(page)  || 1);
  const l = Math.min(100, parseInt(limit) || 25);
  return { limit: l, offset: (p - 1) * l, page: p };
}

async function logAudit(req, action, entity, entityId, details) {
  try {
    await db.query(
      `INSERT INTO audit_logs (username, role, action, entity, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.user?.username, req.user?.role, action, entity, entityId, details, req.ip]
    );
  } catch (_) { /* non-fatal */ }
}

// ─── Scanner Registry ─────────────────────────────────────────────────────────
async function listScanners(req, res, next) {
  try {
    const { status, location, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = [];
    const params = [];

    if (status)   { params.push(status);   conditions.push(`s.operational_status = $${params.length}`); }
    if (location) { params.push(`%${location}%`); conditions.push(`s.location ILIKE $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT s.*,
             c.certification_status, c.certificate_expiry_date, c.application_deadline,
             c.certificate_number,
             (c.certificate_expiry_date - CURRENT_DATE) AS days_until_expiry
      FROM compliance_scanners s
      LEFT JOIN compliance_certificates c ON c.scanner_id = s.id AND c.is_current = TRUE
      ${where}
      ORDER BY s.location_code, s.scanner_serial
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, l, offset]);

    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) FROM compliance_scanners s ${where}`, params
    );
    return res.json({ total: parseInt(cnt[0].count), page: p, limit: l, rows });
  } catch (err) { next(err); }
}

async function getScanner(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`
      SELECT s.*,
             c.id AS cert_id, c.certification_status, c.certificate_number,
             c.certificate_expiry_date, c.application_deadline,
             c.application_submitted_date, c.application_reference,
             c.last_inspection_date, c.inspector_name, c.is_current,
             (c.certificate_expiry_date - CURRENT_DATE) AS days_until_expiry
      FROM compliance_scanners s
      LEFT JOIN compliance_certificates c ON c.scanner_id = s.id AND c.is_current = TRUE
      WHERE s.id = $1
    `, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Scanner not found.' });

    const [scanner] = rows;
    const { rows: certs }  = await db.query(`SELECT * FROM compliance_certificates WHERE scanner_id=$1 ORDER BY created_at DESC`, [id]);
    const { rows: meters } = await db.query(`SELECT * FROM compliance_survey_meters WHERE assigned_to_scanner_id=$1`, [id]);
    return res.json({ ...scanner, certificates: certs, survey_meters: meters });
  } catch (err) { next(err); }
}

async function createScanner(req, res, next) {
  try {
    const {
      asset_tag, scanner_serial, accelerator_serial, manufacturer, model,
      type, location, location_code, operational_status, date_commissioned,
      nra_source_registration_no, radiation_source_activity, notes,
    } = req.body;

    const { rows } = await db.query(`
      INSERT INTO compliance_scanners
        (asset_tag, scanner_serial, accelerator_serial, manufacturer, model, type,
         location, location_code, operational_status, date_commissioned,
         nra_source_registration_no, radiation_source_activity, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [asset_tag, scanner_serial, accelerator_serial, manufacturer, model,
        type || 'fixed', location, location_code, operational_status || 'active',
        date_commissioned, nra_source_registration_no, radiation_source_activity,
        notes, req.user.id]);

    await logAudit(req, 'compliance:scanner_created', 'compliance_scanner', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateScanner(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['asset_tag','scanner_serial','accelerator_serial','manufacturer','model',
                    'type','location','location_code','operational_status','date_commissioned',
                    'date_decommissioned','nra_source_registration_no','radiation_source_activity','notes'];
    const sets = []; const params = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { params.push(req.body[f] === '' ? null : req.body[f]); sets.push(`${f}=$${params.length}`); }});
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(req.user.id); sets.push(`updated_by=$${params.length}`);
    params.push(id);
    const { rows } = await db.query(`UPDATE compliance_scanners SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Scanner not found.' });
    await logAudit(req, 'compliance:scanner_updated', 'compliance_scanner', id, req.body);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Certification ────────────────────────────────────────────────────────────
async function listCertificates(req, res, next) {
  try {
    const { scanner_id, status, expiring_days } = req.query;
    const conditions = []; const params = [];
    if (scanner_id)    { params.push(scanner_id);  conditions.push(`c.scanner_id=$${params.length}`); }
    if (status)        { params.push(status);       conditions.push(`c.certification_status=$${params.length}`); }
    if (expiring_days) { params.push(parseInt(expiring_days)); conditions.push(`c.certificate_expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($${params.length} || ' days')::INTERVAL)`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT c.*, s.scanner_serial, s.location, s.manufacturer, s.model
      FROM compliance_certificates c
      JOIN compliance_scanners s ON s.id = c.scanner_id
      ${where}
      ORDER BY c.certificate_expiry_date ASC NULLS LAST
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createCertificate(req, res, next) {
  try {
    const {
      scanner_id, certificate_number, certificate_type, certification_status,
      last_inspection_date, inspector_name, inspector_organisation,
      certificate_issue_date, certificate_expiry_date, is_current,
      application_submitted_date, application_reference, notes,
    } = req.body;

    const { rows } = await db.query(`
      INSERT INTO compliance_certificates
        (scanner_id, certificate_number, certificate_type, certification_status,
         last_inspection_date, inspector_name, inspector_organisation,
         certificate_issue_date, certificate_expiry_date, is_current,
         application_submitted_date, application_reference, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [scanner_id, certificate_number, certificate_type || 'renewal', certification_status || 'pending',
        last_inspection_date, inspector_name, inspector_organisation,
        certificate_issue_date, certificate_expiry_date, is_current || false,
        application_submitted_date, application_reference, notes, req.user.id]);

    await logAudit(req, 'compliance:certificate_created', 'compliance_certificate', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateCertificate(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['certificate_number','certificate_type','certification_status',
                    'last_inspection_date','inspector_name','inspector_organisation',
                    'certificate_issue_date','certificate_expiry_date','is_current',
                    'application_submitted_date','application_reference','notes'];
    const sets = []; const params = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { params.push(req.body[f] === '' ? null : req.body[f]); sets.push(`${f}=$${params.length}`); }});
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(req.user.id); sets.push(`updated_by=$${params.length}`);
    params.push(id);
    const { rows } = await db.query(`UPDATE compliance_certificates SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Certificate not found.' });
    await logAudit(req, 'compliance:certificate_updated', 'compliance_certificate', id, req.body);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function uploadCertificateDoc(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { rows } = await db.query(`
      UPDATE compliance_certificates SET
        document_path = $1, document_original_name = $2,
        document_uploaded_at = NOW(), document_uploaded_by = $3,
        updated_by = $3
      WHERE id = $4 RETURNING *
    `, [req.file.path, req.file.originalname, req.user.id, id]);
    if (!rows.length) return res.status(404).json({ error: 'Certificate not found.' });
    await logAudit(req, 'compliance:document_uploaded', 'compliance_certificate', id, { file: req.file.originalname });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Survey Meters ────────────────────────────────────────────────────────────
async function listSurveyMeters(req, res, next) {
  try {
    const { status, expiring_days, scanner_id } = req.query;
    const conditions = []; const params = [];
    if (status)        { params.push(status);            conditions.push(`m.operational_status=$${params.length}`); }
    if (scanner_id)    { params.push(scanner_id);         conditions.push(`m.assigned_to_scanner_id=$${params.length}`); }
    if (expiring_days) { params.push(parseInt(expiring_days)); conditions.push(`m.calibration_expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($${params.length} || ' days')::INTERVAL)`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT m.*, s.scanner_serial, s.location,
             (m.calibration_expiry_date - CURRENT_DATE) AS days_until_calibration_expiry
      FROM compliance_survey_meters m
      LEFT JOIN compliance_scanners s ON s.id = m.assigned_to_scanner_id
      ${where}
      ORDER BY m.calibration_expiry_date ASC NULLS LAST
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function createSurveyMeter(req, res, next) {
  try {
    const {
      asset_tag, serial_number, meter_type, manufacturer, model,
      assigned_to_scanner_id, location, operational_status, date_acquired, notes,
    } = req.body;
    const { rows } = await db.query(`
      INSERT INTO compliance_survey_meters
        (asset_tag, serial_number, meter_type, manufacturer, model,
         assigned_to_scanner_id, location, operational_status, date_acquired, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [asset_tag, serial_number, meter_type, manufacturer, model,
        assigned_to_scanner_id || null, location, operational_status || 'active',
        date_acquired, notes, req.user.id]);
    await logAudit(req, 'compliance:meter_created', 'compliance_survey_meter', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateSurveyMeter(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['asset_tag','serial_number','meter_type','manufacturer','model',
                    'assigned_to_scanner_id','location','operational_status','date_acquired','notes'];
    const sets = []; const params = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { params.push(req.body[f] === '' ? null : req.body[f]); sets.push(`${f}=$${params.length}`); }});
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(req.user.id); sets.push(`updated_by=$${params.length}`);
    params.push(id);
    const { rows } = await db.query(`UPDATE compliance_survey_meters SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Survey meter not found.' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function logCalibration(req, res, next) {
  try {
    const { meter_id, calibration_date, calibration_expiry_date, calibration_lab,
            certificate_number, certificate_path, result, technician, notes } = req.body;
    const { rows } = await db.query(`
      INSERT INTO compliance_calibration_records
        (meter_id, calibration_date, calibration_expiry_date, calibration_lab,
         certificate_number, certificate_path, result, technician, notes, logged_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [meter_id, calibration_date, calibration_expiry_date, calibration_lab,
        certificate_number, certificate_path, result, technician, notes, req.user.id]);
    await logAudit(req, 'compliance:calibration_logged', 'compliance_survey_meter', meter_id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
async function listMaintenance(req, res, next) {
  try {
    const { scanner_id, type, vendor, status, from, to, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = []; const params = [];
    if (scanner_id) { params.push(scanner_id);       conditions.push(`m.scanner_id=$${params.length}`); }
    if (type)       { params.push(type);              conditions.push(`m.maintenance_type=$${params.length}`); }
    if (vendor)     { params.push(`%${vendor}%`);     conditions.push(`m.performed_by_name ILIKE $${params.length}`); }
    if (status)     { params.push(status);            conditions.push(`m.status=$${params.length}`); }
    if (from)       { params.push(from);              conditions.push(`m.maintenance_date >= $${params.length}`); }
    if (to)         { params.push(to);                conditions.push(`m.maintenance_date <= $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT m.*, s.scanner_serial, s.location
      FROM compliance_maintenance m
      JOIN compliance_scanners s ON s.id = m.scanner_id
      ${where}
      ORDER BY m.maintenance_date DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);
    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM compliance_maintenance m ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: p, limit: l, rows });
  } catch (err) { next(err); }
}

async function logMaintenance(req, res, next) {
  try {
    const {
      scanner_id, work_order_id, maintenance_date, maintenance_end_date, maintenance_type,
      description, performed_by_type, performed_by_name, technician_name,
      downtime_start, downtime_end, scanner_returned_to_service, return_to_service_date,
      next_scheduled_maintenance, cost, currency, procurement_ref, notes, status,
    } = req.body;
    const { rows } = await db.query(`
      INSERT INTO compliance_maintenance
        (scanner_id, work_order_id, maintenance_date, maintenance_end_date, maintenance_type,
         description, performed_by_type, performed_by_name, technician_name,
         downtime_start, downtime_end, scanner_returned_to_service, return_to_service_date,
         next_scheduled_maintenance, cost, currency, procurement_ref, notes, status, logged_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [scanner_id, work_order_id||null, maintenance_date, maintenance_end_date||null, maintenance_type,
        description, performed_by_type, performed_by_name, technician_name||null,
        downtime_start||null, downtime_end||null, scanner_returned_to_service||false, return_to_service_date||null,
        next_scheduled_maintenance||null, cost||null, currency||'GHS', procurement_ref||null, notes||null,
        status||'completed', req.user.id]);
    await logAudit(req, 'compliance:maintenance_logged', 'compliance_maintenance', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Breakdowns ───────────────────────────────────────────────────────────────
async function listBreakdowns(req, res, next) {
  try {
    const { scanner_id, status, severity, from, to, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = []; const params = [];
    if (scanner_id) { params.push(scanner_id);   conditions.push(`b.scanner_id=$${params.length}`); }
    if (status)     { params.push(status);        conditions.push(`b.status=$${params.length}`); }
    if (severity)   { params.push(severity);      conditions.push(`b.severity=$${params.length}`); }
    if (from)       { params.push(from);          conditions.push(`DATE(b.breakdown_date)>=$${params.length}`); }
    if (to)         { params.push(to);            conditions.push(`DATE(b.breakdown_date)<=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT b.*, s.scanner_serial, s.location
      FROM compliance_breakdowns b
      JOIN compliance_scanners s ON s.id = b.scanner_id
      ${where}
      ORDER BY b.breakdown_date DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);
    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM compliance_breakdowns b ${where}`, params);
    return res.json({ total: parseInt(cnt[0].count), page: p, limit: l, rows });
  } catch (err) { next(err); }
}

async function logBreakdown(req, res, next) {
  try {
    const {
      scanner_id, breakdown_date, severity, description_of_failure, affected_components,
      root_cause, root_cause_category, immediate_action_taken, scanner_taken_offline,
      offline_start, vendor_notified, vendor_name, vendor_notified_date,
      nra_notification_required, notes,
    } = req.body;
    const { rows } = await db.query(`
      INSERT INTO compliance_breakdowns
        (scanner_id, breakdown_date, reported_by, severity, description_of_failure,
         affected_components, root_cause, root_cause_category, immediate_action_taken,
         scanner_taken_offline, offline_start, vendor_notified, vendor_name,
         vendor_notified_date, nra_notification_required, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [scanner_id, breakdown_date||new Date(), req.user.id, severity, description_of_failure,
        affected_components||null, root_cause||null, root_cause_category||null, immediate_action_taken||null,
        scanner_taken_offline||false, offline_start||null, vendor_notified||false, vendor_name||null,
        vendor_notified_date||null, nra_notification_required||false, notes||null]);
    await logAudit(req, 'compliance:breakdown_logged', 'compliance_breakdown', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateBreakdown(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['root_cause','root_cause_category','immediate_action_taken','scanner_taken_offline',
                    'offline_start','return_to_service_date','vendor_notified','vendor_name',
                    'vendor_notified_date','nra_notification_required','nra_notified_date','nra_reference',
                    'linked_repair_id','linked_maintenance_id','status','closed_date','notes','severity'];
    const sets = []; const params = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { params.push(req.body[f]); sets.push(`${f}=$${params.length}`); }});
    if (req.body.status === 'closed' && !req.body.closed_date) {
      params.push(new Date().toISOString().slice(0,10)); sets.push(`closed_date=$${params.length}`);
      params.push(req.user.id); sets.push(`closed_by=$${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update.' });
    params.push(id);
    const { rows } = await db.query(`UPDATE compliance_breakdowns SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Breakdown not found.' });
    await logAudit(req, 'compliance:breakdown_updated', 'compliance_breakdown', id, req.body);
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Repairs ──────────────────────────────────────────────────────────────────
async function logRepair(req, res, next) {
  try {
    const {
      scanner_id, breakdown_id, maintenance_id, repair_type, repair_date, repair_end_date,
      vendor, vendor_job_number, technician, description, components_replaced,
      labour_hours, labour_cost, parts_cost, total_cost, currency, procurement_ref,
      warranty_claim, warranty_reference, scanner_returned_to_service, return_to_service_date, notes,
    } = req.body;
    const { rows } = await db.query(`
      INSERT INTO compliance_repairs
        (scanner_id, breakdown_id, maintenance_id, repair_type, repair_date, repair_end_date,
         vendor, vendor_job_number, technician, description, components_replaced,
         labour_hours, labour_cost, parts_cost, total_cost, currency, procurement_ref,
         warranty_claim, warranty_reference, scanner_returned_to_service, return_to_service_date,
         notes, logged_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *
    `, [scanner_id, breakdown_id||null, maintenance_id||null, repair_type, repair_date, repair_end_date||null,
        vendor||null, vendor_job_number||null, technician||null, description,
        components_replaced ? JSON.stringify(components_replaced) : null,
        labour_hours||null, labour_cost||null, parts_cost||null, total_cost||null,
        currency||'GHS', procurement_ref||null, warranty_claim||false, warranty_reference||null,
        scanner_returned_to_service||false, return_to_service_date||null, notes||null, req.user.id]);
    await logAudit(req, 'compliance:repair_logged', 'compliance_repair', rows[0].id, req.body);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ─── Compliance Dashboard ─────────────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const { rows: kpi } = await db.query(`
      SELECT
        COUNT(*)::int                                                          AS scanners_total,
        COUNT(*) FILTER (WHERE operational_status='active')::int              AS scanners_active,
        COUNT(*) FILTER (WHERE operational_status='decommissioned')::int      AS scanners_decommissioned
      FROM compliance_scanners
    `);

    const { rows: certKpi } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE c.certification_status='issued')::int                                                  AS scanners_certified,
        COUNT(*) FILTER (WHERE c.certificate_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30)::int              AS expiring_30d,
        COUNT(*) FILTER (WHERE c.certificate_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+90)::int              AS expiring_90d,
        COUNT(*) FILTER (WHERE c.certification_status='expired')::int                                                 AS expired,
        COUNT(*) FILTER (WHERE c.application_deadline < CURRENT_DATE AND c.application_submitted_date IS NULL)::int  AS application_overdue
      FROM compliance_certificates c
      WHERE c.is_current = TRUE
    `);

    const { rows: meterKpi } = await db.query(`
      SELECT
        COUNT(*)::int                                                                           AS meters_total,
        COUNT(*) FILTER (WHERE calibration_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30)::int AS calibration_due_30d,
        COUNT(*) FILTER (WHERE calibration_expiry_date < CURRENT_DATE)::int                    AS calibration_expired
      FROM compliance_survey_meters
      WHERE operational_status != 'decommissioned'
    `);

    const { rows: breakdownKpi } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='open')::int           AS open_breakdowns,
        COUNT(*) FILTER (WHERE status='escalated')::int      AS escalated_breakdowns
      FROM compliance_breakdowns
    `);

    const { rows: corrKpi } = await db.query(`
      SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress'))::int AS overdue_corrective_actions
      FROM compliance_corrective_actions
    `);

    const { rows: upcoming } = await db.query(`
      SELECT s.scanner_serial, s.location, c.certificate_expiry_date, c.certification_status,
             c.application_deadline, c.application_submitted_date,
             (c.certificate_expiry_date - CURRENT_DATE) AS days_remaining
      FROM compliance_certificates c
      JOIN compliance_scanners s ON s.id = c.scanner_id
      WHERE c.is_current = TRUE
        AND c.certificate_expiry_date IS NOT NULL
        AND c.certificate_expiry_date >= CURRENT_DATE
      ORDER BY c.certificate_expiry_date ASC
      LIMIT 10
    `);

    const { rows: annualReport } = await db.query(`
      SELECT report_year, status, version FROM compliance_annual_reports
      WHERE report_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      ORDER BY version DESC LIMIT 1
    `);

    return res.json({
      scanners:         { ...kpi[0], ...certKpi[0] },
      survey_meters:    meterKpi[0],
      breakdowns:       breakdownKpi[0],
      corrective:       corrKpi[0],
      upcoming_expirations: upcoming,
      annual_report:    annualReport[0] || { report_year: new Date().getFullYear(), status: 'not_started' },
    });
  } catch (err) { next(err); }
}

// ─── Annual NRA Report ────────────────────────────────────────────────────────
async function generateAnnualReport(req, res, next) {
  try {
    const year = parseInt(req.body.year) || new Date().getFullYear() - 1;

    const [scanners, certs, maintenance, breakdowns, corrective, repairs, calibrations] = await Promise.all([
      db.query(`SELECT * FROM compliance_scanners ORDER BY location_code`),
      db.query(`SELECT c.*, s.scanner_serial FROM compliance_certificates c JOIN compliance_scanners s ON s.id=c.scanner_id WHERE EXTRACT(YEAR FROM COALESCE(c.last_inspection_date, c.certificate_issue_date)) = $1`, [year]),
      db.query(`SELECT m.*, s.scanner_serial FROM compliance_maintenance m JOIN compliance_scanners s ON s.id=m.scanner_id WHERE EXTRACT(YEAR FROM m.maintenance_date) = $1 ORDER BY m.maintenance_date`, [year]),
      db.query(`SELECT b.*, s.scanner_serial FROM compliance_breakdowns b JOIN compliance_scanners s ON s.id=b.scanner_id WHERE EXTRACT(YEAR FROM b.breakdown_date) = $1 ORDER BY b.breakdown_date`, [year]),
      db.query(`SELECT ca.*, s.scanner_serial FROM compliance_corrective_actions ca JOIN compliance_scanners s ON s.id=ca.scanner_id WHERE EXTRACT(YEAR FROM ca.action_date) = $1`, [year]),
      db.query(`SELECT r.*, s.scanner_serial FROM compliance_repairs r JOIN compliance_scanners s ON s.id=r.scanner_id WHERE EXTRACT(YEAR FROM r.repair_date) = $1`, [year]),
      db.query(`SELECT cr.*, m.serial_number FROM compliance_calibration_records cr JOIN compliance_survey_meters m ON m.id=cr.meter_id WHERE EXTRACT(YEAR FROM cr.calibration_date) = $1`, [year]),
    ]);

    const totalMaintCost = maintenance.rows.reduce((s, r) => s + (parseFloat(r.cost)||0), 0);
    const totalRepairCost = repairs.rows.reduce((s, r) => s + (parseFloat(r.total_cost)||0), 0);
    const totalDowntime = breakdowns.rows.reduce((s, r) => s + (parseFloat(r.total_downtime_hours)||0), 0);

    const reportData = {
      report_metadata: {
        report_year: year,
        generated_at: new Date().toISOString(),
        generated_by: req.user.username,
      },
      section_1_scanners:           scanners.rows,
      section_2_certifications:     certs.rows,
      section_3_maintenance:        { total_activities: maintenance.rows.length, total_cost_ghs: totalMaintCost, records: maintenance.rows },
      section_4_breakdowns:         { total_incidents: breakdowns.rows.length, total_downtime_hours: totalDowntime, records: breakdowns.rows },
      section_5_corrective_actions: { total: corrective.rows.length, records: corrective.rows },
      section_6_repairs:            { total: repairs.rows.length, total_cost_ghs: totalRepairCost, records: repairs.rows },
      section_7_survey_meters:      { calibrations_in_year: calibrations.rows.length, records: calibrations.rows },
      section_8_summary: {
        total_maintenance_cost_ghs: totalMaintCost,
        total_repair_cost_ghs: totalRepairCost,
        total_downtime_hours: totalDowntime,
        open_breakdowns: breakdowns.rows.filter(r => r.status === 'open').length,
        open_corrective_actions: corrective.rows.filter(r => ['open','in_progress'].includes(r.status)).length,
      },
    };

    // Check for existing draft or create new version
    const { rows: existing } = await db.query(
      `SELECT MAX(version) AS max_v FROM compliance_annual_reports WHERE report_year=$1`, [year]
    );
    const version = (existing[0]?.max_v || 0) + 1;

    const { rows } = await db.query(`
      INSERT INTO compliance_annual_reports (report_year, version, status, report_data, created_by)
      VALUES ($1,$2,'draft',$3,$4) RETURNING *
    `, [year, version, JSON.stringify(reportData), req.user.id]);

    await logAudit(req, 'compliance:annual_report_generated', 'compliance_annual_report', rows[0].id, { year, version });
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function getAnnualReport(req, res, next) {
  try {
    const { year } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM compliance_annual_reports WHERE report_year=$1 ORDER BY version DESC`, [year]
    );
    if (!rows.length) return res.status(404).json({ error: 'No report found for this year.' });
    return res.json(rows);
  } catch (err) { next(err); }
}

async function submitAnnualReport(req, res, next) {
  try {
    const { id } = req.params;
    const { nra_reference, notes } = req.body;
    const { rows } = await db.query(`
      UPDATE compliance_annual_reports SET
        status='submitted', submitted_date=$1, submitted_by=$2, nra_reference=$3, notes=$4
      WHERE id=$5 AND status IN ('approved','draft')
      RETURNING *
    `, [new Date().toISOString().slice(0,10), req.user.id, nra_reference||null, notes||null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Report not found or cannot be submitted.' });
    await logAudit(req, 'compliance:annual_report_submitted', 'compliance_annual_report', id, { nra_reference });
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

async function exportAnnualReport(req, res, next) {
  try {
    const { year } = req.params;
    const { format = 'xlsx' } = req.query;
    const { rows } = await db.query(
      `SELECT * FROM compliance_annual_reports WHERE report_year=$1 ORDER BY version DESC LIMIT 1`, [year]
    );
    if (!rows.length) return res.status(404).json({ error: 'No report found.' });
    const report = rows[0];
    const data = report.report_data;

    if (format === 'json') {
      return res.json(data);
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const addSheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
      addSheet('Scanners',           data.section_1_scanners || []);
      addSheet('Certifications',     data.section_2_certifications || []);
      addSheet('Maintenance',        data.section_3_maintenance?.records || []);
      addSheet('Breakdowns',         data.section_4_breakdowns?.records || []);
      addSheet('Corrective Actions', data.section_5_corrective_actions?.records || []);
      addSheet('Repairs',            data.section_6_repairs?.records || []);
      addSheet('Calibrations',       data.section_7_survey_meters?.records || []);
      addSheet('Summary',            [data.section_8_summary || {}]);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="NRA-Annual-Report-${year}.xlsx"`);
      return res.send(buf);
    }

    return res.status(400).json({ error: 'Unsupported format. Use xlsx or json.' });
  } catch (err) { next(err); }
}

// ─── Reporting ────────────────────────────────────────────────────────────────
async function getMaintenanceReport(req, res, next) {
  try {
    const { scanner_id, from, to, type, vendor, page, limit } = req.query;
    const { limit: l, offset, page: p } = paginate(page, limit);
    const conditions = []; const params = [];
    if (scanner_id) { params.push(scanner_id); conditions.push(`m.scanner_id=$${params.length}`); }
    if (type)       { params.push(type);       conditions.push(`m.maintenance_type=$${params.length}`); }
    if (vendor)     { params.push(`%${vendor}%`); conditions.push(`m.performed_by_name ILIKE $${params.length}`); }
    if (from)       { params.push(from);       conditions.push(`m.maintenance_date>=$${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`m.maintenance_date<=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT m.*, s.scanner_serial, s.location, s.manufacturer
      FROM compliance_maintenance m
      JOIN compliance_scanners s ON s.id=m.scanner_id
      ${where}
      ORDER BY m.maintenance_date DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, l, offset]);
    const { rows: totals } = await db.query(`
      SELECT COUNT(*)::int AS total_jobs, SUM(cost) AS total_cost, SUM(downtime_hours) AS total_downtime_hours
      FROM compliance_maintenance m ${where}
    `, params);
    return res.json({ ...totals[0], page: p, limit: l, rows });
  } catch (err) { next(err); }
}

async function getVendorPerformance(req, res, next) {
  try {
    const { from, to } = req.query;
    const params = [from || '2000-01-01', to || new Date().toISOString().slice(0,10)];
    const { rows } = await db.query(`
      SELECT performed_by_name AS vendor,
             COUNT(*)::int AS job_count,
             ROUND(AVG(downtime_hours),1) AS avg_downtime_hours,
             SUM(cost) AS total_cost,
             ROUND(AVG(maintenance_end_date - maintenance_date),1) AS avg_duration_days
      FROM compliance_maintenance
      WHERE maintenance_date BETWEEN $1 AND $2
      GROUP BY performed_by_name
      ORDER BY job_count DESC
    `, params);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function getComplianceRate(req, res, next) {
  try {
    const { year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const { rows } = await db.query(`
      WITH year_range AS (
        SELECT DATE '${ y }-01-01' AS year_start, DATE '${ y }-12-31' AS year_end,
               (DATE '${ y }-12-31' - DATE '${ y }-01-01' + 1) AS total_days
      ),
      cert_intervals AS (
        SELECT s.id AS scanner_id, s.scanner_serial,
               GREATEST(c.certificate_issue_date, yr.year_start) AS cert_start,
               LEAST(c.certificate_expiry_date, yr.year_end) AS cert_end
        FROM compliance_scanners s
        JOIN compliance_certificates c ON c.scanner_id=s.id
        CROSS JOIN year_range yr
        WHERE c.certificate_issue_date <= yr.year_end
          AND c.certificate_expiry_date >= yr.year_start
      )
      SELECT s.scanner_serial, s.location,
             yr.total_days,
             COALESCE(SUM(GREATEST(0, ci.cert_end - ci.cert_start + 1)), 0)::int AS certified_days,
             (yr.total_days - COALESCE(SUM(GREATEST(0, ci.cert_end - ci.cert_start + 1)), 0))::int AS non_certified_days,
             ROUND(COALESCE(SUM(GREATEST(0, ci.cert_end - ci.cert_start + 1)), 0) * 100.0 / yr.total_days, 1) AS compliance_pct
      FROM compliance_scanners s
      CROSS JOIN year_range yr
      LEFT JOIN cert_intervals ci ON ci.scanner_id=s.id
      GROUP BY s.scanner_serial, s.location, yr.total_days
      ORDER BY compliance_pct ASC
    `);
    return res.json({ year: y, rows });
  } catch (err) { next(err); }
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function getNotifications(req, res, next) {
  try {
    const { rows } = await db.query(`
      WITH user_role AS (
        SELECT r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1
      )
      SELECT n.* FROM compliance_notifications n, user_role
      WHERE n.is_dismissed = FALSE
        AND (
          n.user_id = $1
          OR n.role_target = user_role.role_name
          OR (n.role_target = 'supervisor' AND user_role.role_name = 'admin')
        )
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    return res.json(rows);
  } catch (err) { next(err); }
}

async function markNotificationRead(req, res, next) {
  try {
    await db.query(
      `UPDATE compliance_notifications SET is_read=TRUE WHERE id=$1`,
      [req.params.id]
    );
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

async function triggerReminders(req, res, next) {
  try {
    const { runComplianceReminders } = require('../services/scheduler');
    await runComplianceReminders();
    return res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  listScanners, getScanner, createScanner, updateScanner,
  listCertificates, createCertificate, updateCertificate, uploadCertificateDoc,
  listSurveyMeters, createSurveyMeter, updateSurveyMeter, logCalibration,
  listMaintenance, logMaintenance,
  listBreakdowns, logBreakdown, updateBreakdown,
  logRepair,
  getDashboard,
  generateAnnualReport, getAnnualReport, submitAnnualReport, exportAnnualReport,
  getMaintenanceReport, getVendorPerformance, getComplianceRate,
  getNotifications, markNotificationRead, triggerReminders,
};
