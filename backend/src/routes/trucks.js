const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  createTruckAllocation, releaseTruck, listTruckAllocations, getAvailableBays,
} = require('../controllers/truckController');

router.use(authenticate);

router.get('/bays',            requirePermission('container:view'),    getAvailableBays);
router.get('/',                requirePermission('container:view'),    listTruckAllocations);
router.post('/',               requirePermission('container:allocate'), createTruckAllocation);
router.post('/:id/release',    requirePermission('container:confirm_exit'), releaseTruck);

module.exports = router;
