const router = require('express').Router();
const { authenticate }     = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const gc = require('../controllers/gangController');

router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard',                  requirePermission('gang.view'),     gc.getDashboard);

// ── Gangs ─────────────────────────────────────────────────────────────────────
router.get('/',                           requirePermission('gang.view'),     gc.listGangs);
router.get('/:id',                        requirePermission('gang.view'),     gc.getGang);
router.post('/',                          requirePermission('gang.manage'),   gc.createGang);
router.put('/:id',                        requirePermission('gang.manage'),   gc.updateGang);
router.patch('/:id/status',              requirePermission('gang.manage'),   gc.setGangStatus);

// ── Gang Members ──────────────────────────────────────────────────────────────
router.get('/:id/members',                requirePermission('gang.view'),     gc.listMembers);
router.post('/:id/members',               requirePermission('gang.manage'),   gc.addMember);
router.put('/:id/members/:memberId',      requirePermission('gang.manage'),   gc.updateMember);
router.delete('/:id/members/:memberId',   requirePermission('gang.manage'),   gc.removeMember);

// ── Agent Requests ────────────────────────────────────────────────────────────
router.get('/requests/list',              requirePermission('gang.view'),     gc.listRequests);
router.post('/requests',                  requirePermission('gang.view'),     gc.createRequest);
router.patch('/requests/:id/cancel',      requirePermission('gang.allocate'), gc.cancelRequest);

// ── Allocation Engine ─────────────────────────────────────────────────────────
router.get('/engine/recommend',           requirePermission('gang.allocate'), gc.recommendGangs);
router.post('/allocations',               requirePermission('gang.allocate'), gc.createAllocation);
router.get('/allocations/list',           requirePermission('gang.view'),     gc.listAllocations);

// ── Job Execution ─────────────────────────────────────────────────────────────
router.post('/allocations/:id/timestamp', requirePermission('gang.log'),      gc.logTimestamp);
router.post('/allocations/:id/complete',  requirePermission('gang.log'),      gc.completeJob);
router.post('/allocations/:id/delay',     requirePermission('gang.log'),      gc.logDelay);
router.get('/allocations/:id/delays',     requirePermission('gang.view'),     gc.getDelays);
router.post('/allocations/:id/feedback',  requirePermission('gang.view'),     gc.submitFeedback);

// ── Performance ───────────────────────────────────────────────────────────────
router.get('/analytics/performance',      requirePermission('gang.view'),     gc.getPerformance);
router.get('/analytics/audit',            requirePermission('gang.view'),     gc.getAuditLog);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications/list',         requirePermission('gang.view'),     gc.getNotifications);
router.patch('/notifications/:id/read',   requirePermission('gang.view'),     gc.markNotificationRead);

module.exports = router;
