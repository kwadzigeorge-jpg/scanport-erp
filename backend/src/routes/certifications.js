const router = require('express').Router();
const { list, getOne, create, update, remove, uploadDocument, removeDocument } = require('../controllers/certificationController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);
router.get('/', list);
router.get('/:id', getOne);
router.post('/', requireAdmin, create);
router.put('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);
router.patch('/:id/document', requireAdmin, upload.single('document'), uploadDocument);
router.delete('/:id/document', requireAdmin, removeDocument);

module.exports = router;
