const router = require('express').Router();
const { getStats, getExpiringList } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/stats', getStats);
router.get('/expiring', getExpiringList);

module.exports = router;
