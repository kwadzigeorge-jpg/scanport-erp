const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  checkIn, assignBay, allocate,
  confirmEntry, startExamination, completeExamination, confirmExit,
  listTransactions, getTransaction, override, verifyQR,
  listHoldingAreas, baysView, statusSummary,
  reinstateContainer,
} = require('../controllers/containerController');

// Public: QR scan verification (no auth required — scanned at gate)
router.get('/verify/:token', verifyQR);

router.use(authenticate);

// ── Reference data ──────────────────────────────────────────────────────────
router.get('/holding-areas', listHoldingAreas);
router.get('/bays-view',     requirePermission('dashboard:view'), baysView);
router.get('/status-summary', requirePermission('dashboard:view'), statusSummary);

// ── Booth Officer: check-in and bay assignment ──────────────────────────────
router.post('/check-in',         requirePermission('container:allocate'), checkIn);
router.post('/:id/assign-bay',   requirePermission('container:allocate'), assignBay);

// ── Legacy one-step allocation (kept for backward compat) ───────────────────
router.post('/allocate',         requirePermission('container:allocate'), allocate);

// ── Marshal: full examination workflow ─────────────────────────────────────
router.post('/confirm-entry',              requirePermission('container:confirm_entry'),      confirmEntry);
router.post('/:id/start-examination',      requirePermission('container:start_examination'),  startExamination);
router.post('/:id/complete-examination',   requirePermission('container:complete_examination'), completeExamination);
router.post('/confirm-exit',               requirePermission('container:release'),            confirmExit);

// ── List / detail ────────────────────────────────────────────────────────────
router.get('/',    requirePermission('container:view'), listTransactions);
router.get('/:id', requirePermission('container:view'), getTransaction);

// ── Supervisor override ──────────────────────────────────────────────────────
router.put('/:id/override', requirePermission('container:override'), override);

// ── Admin: reinstate a mistakenly released/cancelled container ───────────────
router.post('/:id/reinstate', requirePermission('container:override'), reinstateContainer);

module.exports = router;
