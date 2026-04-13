const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  dailyReport, dwellTimeReport, agentPerformanceReport,
  auditTrail, exceptionReport, getSystemConfig, updateSystemConfig,
} = require('../controllers/reportController');

router.use(authenticate);

router.get('/daily',             requirePermission('reports:view'), dailyReport);
router.get('/dwell-time',        requirePermission('reports:view'), dwellTimeReport);
router.get('/agent-performance', requirePermission('reports:view'), agentPerformanceReport);
router.get('/exceptions',        requirePermission('reports:view'), exceptionReport);
router.get('/audit',             requirePermission('audit:view'),   auditTrail);

// System config
router.get('/config',            requirePermission('config:view'),  getSystemConfig);
router.put('/config',            requirePermission('config:edit'),  updateSystemConfig);

module.exports = router;
