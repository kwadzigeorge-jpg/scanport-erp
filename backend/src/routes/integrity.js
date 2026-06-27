const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const ic = require('../controllers/integrityController');

// ── Public (no auth, no IP logging) ──────────────────────────────────────────
router.post('/', ic.submitReport);

// ── Protected — admin/integrity roles only ────────────────────────────────────
router.use(authenticate);

router.get('/dashboard',     requirePermission('integrity.view'),   ic.getDashboard);
router.get('/export',        requirePermission('integrity.manage'), ic.exportReports);
router.get('/',              requirePermission('integrity.view'),   ic.listReports);
router.get('/:id',           requirePermission('integrity.view'),   ic.getReport);
router.post('/:id/status',   requirePermission('integrity.manage'), ic.changeStatus);
router.post('/:id/note',     requirePermission('integrity.manage'), ic.addNote);

module.exports = router;
