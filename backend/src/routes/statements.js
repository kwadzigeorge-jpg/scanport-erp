const router = require('express').Router();
const gc = require('../controllers/grievanceController');

// Public — no authentication required, access via unique token
router.get('/:token',  gc.getStatementByToken);
router.post('/:token', gc.submitStatementByToken);

module.exports = router;
