const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  dailyReport, dwellTimeReport, agentPerformanceReport,
  auditTrail, exceptionReport, getSystemConfig, updateSystemConfig,
  operationsDashboard, dwellAnalysis, areaPerformance, slaExceptions, exportReport,
  getEmailConfig, updateEmailConfig, testEmail,
} = require('../controllers/reportController');

router.use(authenticate);

// ── New analytics endpoints ──────────────────────────────────────────────────
router.get('/operations-dashboard', requirePermission('report.view'), operationsDashboard);
router.get('/dwell-analysis',       requirePermission('report.view'), dwellAnalysis);
router.get('/area-performance',     requirePermission('report.view'), areaPerformance);
router.get('/sla-exceptions',       requirePermission('report.view'), slaExceptions);
router.get('/export',               requirePermission('report.export'), exportReport);

// ── Legacy endpoints (kept for compatibility) ────────────────────────────────
router.get('/daily',             requirePermission('report.view'),    dailyReport);
router.get('/dwell-time',        requirePermission('report.view'),    dwellTimeReport);
router.get('/agent-performance', requirePermission('report.view'),    agentPerformanceReport);
router.get('/exceptions',        requirePermission('report.view'),    exceptionReport);
router.get('/audit',             requirePermission('audit.view'),     auditTrail);

// ── Email & alerts config ─────────────────────────────────────────────────────
router.get('/email-config',  requirePermission('report.email_config'), getEmailConfig);
router.put('/email-config',  requirePermission('report.email_config'), updateEmailConfig);
router.post('/test-email',   requirePermission('report.email_config'), testEmail);

// ── System config ────────────────────────────────────────────────────────────
router.get('/config',            requirePermission('config.view'),  getSystemConfig);
router.put('/config',            requirePermission('config.edit'),  updateSystemConfig);

module.exports = router;
