const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { getSummary, getOverstayed } = require('../controllers/dashboardController');

router.use(authenticate);
router.use(requirePermission('dashboard:view'));

router.get('/summary',    getSummary);
router.get('/overstayed', getOverstayed);

module.exports = router;
