const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  dailyReport, dwellTimeReport, agentPerformanceReport,
  auditTrail, exceptionReport, getSystemConfig, updateSystemConfig,
  operationsDashboard, dwellAnalysis, areaPerformance, slaExceptions, exportReport,
} = require('../controllers/reportController');

router.use(authenticate);

// ── New analytics endpoints ──────────────────────────────────────────────────
router.get('/operations-dashboard', requirePermission('reports:view'), operationsDashboard);
router.get('/dwell-analysis',       requirePermission('reports:view'), dwellAnalysis);
router.get('/area-performance',     requirePermission('reports:view'), areaPerformance);
router.get('/sla-exceptions',       requirePermission('reports:view'), slaExceptions);
router.get('/export',               requirePermission('reports:view'), exportReport);

// ── Legacy endpoints (kept for compatibility) ────────────────────────────────
router.get('/daily',             requirePermission('reports:view'), dailyReport);
router.get('/dwell-time',        requirePermission('reports:view'), dwellTimeReport);
router.get('/agent-performance', requirePermission('reports:view'), agentPerformanceReport);
router.get('/exceptions',        requirePermission('reports:view'), exceptionReport);
router.get('/audit',             requirePermission('audit:view'),   auditTrail);

// ── System config ────────────────────────────────────────────────────────────
router.get('/config',            requirePermission('config:view'),  getSystemConfig);
router.put('/config',            requirePermission('config:edit'),  updateSystemConfig);

module.exports = router;
