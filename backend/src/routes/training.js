const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const tc = require('../controllers/trainingController');

router.use(authenticate);

router.get('/dashboard',       requirePermission('training.view'),   tc.getDashboard);
router.get('/export/records',  requirePermission('training.view'),   tc.exportRecords);
router.get('/export/matrix',   requirePermission('training.view'),   tc.exportMatrix);
router.get('/types',           requirePermission('training.view'),   tc.listTypes);
router.post('/types',          requirePermission('training.manage'), tc.createType);
router.put('/types/:id',       requirePermission('training.manage'), tc.updateType);
router.get('/matrix',          requirePermission('training.view'),   tc.getMatrix);
router.get('/upcoming',        requirePermission('training.view'),   tc.getUpcoming);
router.get('/teams',           requirePermission('training.view'),   tc.listTeams);
router.get('/records',         requirePermission('training.view'),   tc.listRecords);
router.post('/records',        requirePermission('training.manage'), tc.createRecord);
router.put('/records/:id',     requirePermission('training.manage'), tc.updateRecord);
router.delete('/records/:id',  requirePermission('training.manage'), tc.deleteRecord);

module.exports = router;
