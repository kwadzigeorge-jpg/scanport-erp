const router = require('express').Router();
const { authenticate }      = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const bc = require('../controllers/bayAdminController');

router.use(authenticate);

// Holding Areas
router.get('/areas',               requirePermission('bay.view'),   bc.listAreas);
router.post('/areas',              requirePermission('bay.manage'), bc.createArea);
router.put('/areas/:id',           requirePermission('bay.manage'), bc.updateArea);
router.patch('/areas/:id/toggle',  requirePermission('bay.manage'), bc.toggleArea);

// Bays
router.get('/',              requirePermission('bay.view'),   bc.listBays);
router.post('/',             requirePermission('bay.manage'), bc.createBay);
router.put('/:id',           requirePermission('bay.manage'), bc.updateBay);
router.patch('/:id/toggle',  requirePermission('bay.manage'), bc.toggleBay);
router.delete('/:id',        requirePermission('bay.manage'), bc.deleteBay);

module.exports = router;
