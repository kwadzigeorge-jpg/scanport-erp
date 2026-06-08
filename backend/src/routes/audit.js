const router = require('express').Router();
const { list } = require('../controllers/auditController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);
router.get('/', list);

module.exports = router;
