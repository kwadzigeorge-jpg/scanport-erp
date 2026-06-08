const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const fc = require('../controllers/feedbackController');

// ── Public (no auth) ──────────────────────────────────────────────────────────
router.post('/', fc.submitFeedback);

// ── Protected ─────────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/dashboard',     requirePermission('feedback.view'),   fc.getDashboard);
router.get('/export',        requirePermission('feedback.export'), fc.exportFeedback);
router.get('/',              requirePermission('feedback.view'),   fc.listFeedback);
router.get('/:id',           requirePermission('feedback.view'),   fc.getFeedback);
router.post('/:id/status',   requirePermission('feedback.manage'), fc.changeStatus);
router.post('/:id/note',     requirePermission('feedback.view'),   fc.addNote);

module.exports = router;
