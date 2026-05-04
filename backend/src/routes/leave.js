const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const c = require('../controllers/leaveController');

router.use(authenticate);

const adminOrSuper = requireRole('admin', 'supervisor');
const adminOnly    = requireRole('admin');

// Overview
router.get('/overview',         adminOrSuper, c.getOverview);

// Requests
router.get('/requests',         adminOrSuper, c.getRequests);
router.post('/requests',        adminOrSuper, c.submitRequest);
router.put('/requests/:id/approve', adminOnly, c.approveRequest);
router.put('/requests/:id/reject',  adminOnly, c.rejectRequest);
router.delete('/requests/:id',      adminOnly, c.deleteRequest);

// Balances
router.get('/balances',         adminOrSuper, c.getBalances);

// Departments & teams
router.get('/departments',      adminOrSuper, c.getDepartments);
router.post('/departments',     adminOnly,    c.createDepartment);
router.delete('/departments/:id', adminOnly,  c.deleteDepartment);
router.post('/departments/:deptId/teams',        adminOnly, c.addTeam);
router.delete('/departments/:deptId/teams/:teamId', adminOnly, c.deleteTeam);

// Staff
router.get('/staff',           adminOrSuper, c.getStaff);
router.post('/staff',          adminOnly,    c.addStaff);
router.put('/staff/:id',       adminOnly,    c.updateStaff);
router.delete('/staff/:id',    adminOnly,    c.removeStaff);

// Holidays
router.get('/holidays',        adminOrSuper, c.getHolidays);
router.post('/holidays',       adminOnly,    c.addHoliday);
router.delete('/holidays/:id', adminOnly,    c.deleteHoliday);

module.exports = router;
