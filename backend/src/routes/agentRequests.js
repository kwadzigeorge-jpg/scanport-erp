const router = require('express').Router();
const ctrl   = require('../controllers/agentRequestController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get  ('/stats', ctrl.stats);
router.get  ('/',      ctrl.list);
router.get  ('/:id',   ctrl.getOne);
router.post ('/',      ctrl.create);
router.patch('/:id',   ctrl.update);

module.exports = router;
