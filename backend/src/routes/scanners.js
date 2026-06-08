const router = require('express').Router();
const { list, getOne, create, update, remove } = require('../controllers/scannerController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);
router.get('/', list);
router.get('/:id', getOne);
router.post('/', requireAdmin, create);
router.put('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);

module.exports = router;
