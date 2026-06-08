const router = require('express').Router();
const { list, getOne, markSent, update, listAlerts, resolveAlert } = require('../controllers/notificationController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);
router.get('/', list);
router.get('/alerts', listAlerts);
router.get('/:id', getOne);
router.patch('/:id/mark-sent', requireAdmin, upload.single('document'), markSent);
router.put('/:id', requireAdmin, upload.single('document'), update);
router.patch('/alerts/:id/resolve', requireAdmin, resolveAlert);

module.exports = router;
