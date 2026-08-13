const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  createTruckAllocation, releaseTruck, listTruckAllocations, getAvailableBays,
  checkinReeferContainer, releaseReeferContainer, addContainersToAllocation,
} = require('../controllers/truckController');

router.use(authenticate);

router.get('/bays',                            requirePermission('allocation.view'),  getAvailableBays);
router.get('/',                                requirePermission('truck.view'),       listTruckAllocations);
router.post('/',                               requirePermission('truck.create'),     createTruckAllocation);
router.post('/:id/release',                    requirePermission('truck.release'),    releaseTruck);
router.post('/:id/containers',                 requirePermission('truck.bay_assign'), addContainersToAllocation);
router.patch('/containers/:id/checkin',        requirePermission('truck.bay_assign'), checkinReeferContainer);
router.patch('/containers/:id/release',        requirePermission('truck.release'),    releaseReeferContainer);

module.exports = router;
