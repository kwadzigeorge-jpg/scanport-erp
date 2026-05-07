const router = require('express').Router();
const { authenticate }     = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const gc = require('../controllers/grievanceController');

router.use(authenticate);

// Named routes must come before /:id
router.get('/dashboard',      requirePermission('grievance.view'),   gc.getDashboard);
router.get('/export',         requirePermission('grievance.export'), gc.exportGrievances);
router.post('/check-overdue', requirePermission('grievance.manage'), gc.checkOverdue);
router.get('/config',         requirePermission('grievance.view'),   gc.listConfig);
router.post('/config',        requirePermission('grievance.manage'), gc.createConfig);
router.delete('/config/:id',  requirePermission('grievance.manage'), gc.deleteConfig);

router.get('/',               requirePermission('grievance.view'),   gc.listGrievances);
router.post('/',              requirePermission('grievance.create'),  gc.createGrievance);

router.get('/:id',            requirePermission('grievance.view'),   gc.getGrievance);
router.put('/:id',            requirePermission('grievance.manage'), gc.updateGrievance);
router.post('/:id/status',    requirePermission('grievance.manage'), gc.changeStatus);
router.post('/:id/note',      requirePermission('grievance.view'),   gc.addNote);

module.exports = router;
