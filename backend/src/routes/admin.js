const router = require('express').Router();
const { smtpTest, downloadBackup, listBackups } = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);
router.post('/smtp-test', smtpTest);
router.get('/backup', downloadBackup);
router.get('/backups', listBackups);

module.exports = router;
