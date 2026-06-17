const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const fc = require('../controllers/fleetController');

router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', requirePermission('fleet.view'), fc.getDashboard);

// ── Alerts (before /:id) ──────────────────────────────────────────────────────
router.get('/alerts',                requirePermission('fleet.view'), fc.listAlerts);
router.patch('/alerts/:id/dismiss',  requirePermission('fleet.view'), fc.dismissAlert);

// ── Drivers (before /:id) ─────────────────────────────────────────────────────
router.get('/drivers/list',  requirePermission('fleet.view'),   fc.listDrivers);
router.post('/drivers',      requirePermission('fleet.manage'), fc.createDriver);
router.put('/drivers/:id',   requirePermission('fleet.manage'), fc.updateDriver);

// ── Mileage (before /:id) ─────────────────────────────────────────────────────
router.get('/mileage/list',           requirePermission('fleet.view'),    fc.listMileageLogs);
router.post('/mileage',               requirePermission('fleet.log'),     fc.createMileageLog);
router.patch('/mileage/:id/approve',  requirePermission('fleet.approve'), fc.approveMileageLog);
router.patch('/mileage/:id/reject',   requirePermission('fleet.approve'), fc.rejectMileageLog);

// ── Fuel (before /:id) ────────────────────────────────────────────────────────
router.get('/fuel/list',  requirePermission('fleet.view'), fc.listFuelLogs);
router.post('/fuel',      requirePermission('fleet.log'),  fc.createFuelLog);

// ── Maintenance (before /:id) ─────────────────────────────────────────────────
router.get('/maintenance/list',  requirePermission('fleet.view'),   fc.listMaintenance);
router.post('/maintenance',      requirePermission('fleet.manage'), fc.createMaintenance);
router.put('/maintenance/:id',   requirePermission('fleet.manage'), fc.updateMaintenance);

// ── Vehicles ──────────────────────────────────────────────────────────────────
router.get('/',              requirePermission('fleet.view'),   fc.listVehicles);
router.post('/',             requirePermission('fleet.manage'), fc.createVehicle);
router.get('/:id',           requirePermission('fleet.view'),   fc.getVehicle);
router.put('/:id',           requirePermission('fleet.manage'), fc.updateVehicle);
router.patch('/:id/status',  requirePermission('fleet.manage'), fc.setVehicleStatus);
router.post('/:id/drivers',              requirePermission('fleet.manage'), fc.assignDriver);
router.delete('/:id/drivers/:driverId',  requirePermission('fleet.manage'), fc.unassignDriver);

module.exports = router;
