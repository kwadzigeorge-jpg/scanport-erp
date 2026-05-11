const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission }  = require('../middleware/rbac');
const cc = require('../controllers/complianceController');

router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard',                    requirePermission('compliance.view'),          cc.getDashboard);

// ── Scanner Registry ──────────────────────────────────────────────────────────
router.get('/scanners',                     requirePermission('compliance.view'),          cc.listScanners);
router.get('/scanners/:id',                 requirePermission('compliance.view'),          cc.getScanner);
router.post('/scanners',                    requirePermission('compliance.edit'),          cc.createScanner);
router.put('/scanners/:id',                 requirePermission('compliance.edit'),          cc.updateScanner);

// ── Certification ─────────────────────────────────────────────────────────────
router.get('/certificates',                 requirePermission('compliance.view'),          cc.listCertificates);
router.post('/certificates',                requirePermission('compliance.edit'),          cc.createCertificate);
router.put('/certificates/:id',             requirePermission('compliance.edit'),          cc.updateCertificate);
router.post('/certificates/:id/upload',     requirePermission('compliance.upload_certificate'), cc.uploadCertificateDoc);
router.post('/certificates/:id/submit-application', requirePermission('compliance.submit_application'), async (req, res, next) => {
  req.body.certification_status   = 'application_submitted';
  req.body.application_submitted_date = req.body.application_submitted_date || new Date().toISOString().slice(0,10);
  return cc.updateCertificate(req, res, next);
});

// ── Survey Meters ─────────────────────────────────────────────────────────────
router.get('/survey-meters',                requirePermission('compliance.view'),          cc.listSurveyMeters);
router.post('/survey-meters',               requirePermission('compliance.edit'),          cc.createSurveyMeter);
router.put('/survey-meters/:id',            requirePermission('compliance.edit'),          cc.updateSurveyMeter);
router.post('/survey-meters/calibrations',  requirePermission('calibration.log'),          cc.logCalibration);

// ── Maintenance ───────────────────────────────────────────────────────────────
router.get('/maintenance',                  requirePermission('maintenance.view'),         cc.listMaintenance);
router.post('/maintenance',                 requirePermission('maintenance.log'),          cc.logMaintenance);

// ── Breakdowns ────────────────────────────────────────────────────────────────
router.get('/breakdowns',                   requirePermission('compliance.view'),          cc.listBreakdowns);
router.post('/breakdowns',                  requirePermission('breakdown.log'),            cc.logBreakdown);
router.put('/breakdowns/:id',               requirePermission('breakdown.edit'),           cc.updateBreakdown);

// ── Repairs ───────────────────────────────────────────────────────────────────
router.post('/repairs',                     requirePermission('repair.log'),               cc.logRepair);

// ── Annual NRA Report ─────────────────────────────────────────────────────────
router.post('/annual-report/generate',      requirePermission('report.generate'),          cc.generateAnnualReport);
router.get('/annual-report/:year',          requirePermission('report.compliance_view'),   cc.getAnnualReport);
router.get('/annual-report/:year/export',   requirePermission('report.compliance_view'),   cc.exportAnnualReport);
router.post('/annual-report/:id/submit',    requirePermission('report.submit'),            cc.submitAnnualReport);

// ── Operational Reports ───────────────────────────────────────────────────────
router.get('/reports/maintenance',          requirePermission('report.compliance_view'),   cc.getMaintenanceReport);
router.get('/reports/vendor-performance',   requirePermission('report.compliance_view'),   cc.getVendorPerformance);
router.get('/reports/compliance-rate',      requirePermission('report.compliance_view'),   cc.getComplianceRate);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications',                requirePermission('compliance.view'),          cc.getNotifications);
router.put('/notifications/:id/read',       requirePermission('compliance.view'),          cc.markNotificationRead);
router.post('/notifications/run-reminders', requirePermission('compliance.edit'),          cc.triggerReminders);

module.exports = router;
