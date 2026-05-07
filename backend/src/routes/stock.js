const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission }  = require('../middleware/rbac');
const sc = require('../controllers/stockController');

router.use(authenticate);

// ── Balances & ledger ────────────────────────────────────────────────────────
router.get('/balances',                   requirePermission('stock.view'),     sc.getBalances);
router.get('/balances/:partId',           requirePermission('stock.view'),     sc.getPartStock);
router.get('/ledger/:partId',             requirePermission('stock.view'),     sc.getLedger);

// ── Movements ────────────────────────────────────────────────────────────────
router.post('/in',                        requirePermission('stock.receive'),  sc.stockIn);
router.post('/out',                       requirePermission('stock.issue'),    sc.stockOut);
router.post('/return',                    requirePermission('stock.issue'),    sc.stockReturn);
router.post('/adjust',                    requirePermission('stock.adjust'),   sc.adjust);
router.post('/transfer',                  requirePermission('stock.transfer'), sc.transfer);

// ── Reservations ─────────────────────────────────────────────────────────────
router.get('/reservations',               requirePermission('stock.view'),     sc.listReservations);
router.post('/reservations',              requirePermission('stock.reserve'),  sc.createReservation);
router.delete('/reservations/:id',        requirePermission('stock.reserve'),  sc.cancelReservation);

// ── Alerts ───────────────────────────────────────────────────────────────────
router.get('/alerts',                     requirePermission('alert.inventory_view'), sc.getAlerts);
router.put('/alerts/:id/resolve',         requirePermission('stock.adjust'),         sc.resolveAlert);

// ── Reorder & reports ────────────────────────────────────────────────────────
router.get('/reorder-list',               requirePermission('stock.view'),            sc.getReorderList);
router.get('/reports/valuation',          requirePermission('report.inventory_view'), sc.getValuationReport);
router.get('/reports/consumption',        requirePermission('report.inventory_view'), sc.getConsumptionReport);
router.get('/reports/slow-movers',        requirePermission('report.inventory_view'), sc.getSlowMoversReport);
router.get('/reports/movement',           requirePermission('stock.view'),           sc.getMovementReport);

module.exports = router;
