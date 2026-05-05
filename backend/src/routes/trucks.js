const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  createTruckAllocation, releaseTruck, listTruckAllocations, getAvailableBays,
} = require('../controllers/truckController');

router.use(authenticate);

router.get('/bays',            requirePermission('allocation.view'),   getAvailableBays);
router.get('/',                requirePermission('truck.view'),        listTruckAllocations);
router.post('/',               requirePermission('truck.create'),      createTruckAllocation);
router.post('/:id/release',    requirePermission('truck.release'),     releaseTruck);

module.exports = router;
