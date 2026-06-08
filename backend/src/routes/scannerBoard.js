const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getBoard, updateScanner, updateHeader, getHistory, clearHistory,
} = require('../controllers/scannerBoardController');

router.use(authenticate);

router.get('/',              getBoard);
router.patch('/:scanner',    updateScanner);
router.patch('/header/meta', updateHeader);
router.get('/history',       getHistory);
router.delete('/history',    clearHistory);

module.exports = router;
