const router = require('express').Router();
const { authenticate }     = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const pc = require('../controllers/partsController');

router.use(authenticate);

// ── Reference / lookup data (MUST be before /:id) ──────────────────────────
router.get('/categories',          requirePermission('part.view'),               pc.listCategories);
router.post('/categories',         requirePermission('part.create'),             pc.createCategory);
router.put('/categories/:id',      requirePermission('part.edit'),               pc.updateCategory);
router.delete('/categories/:id',   requirePermission('part.delete'),             pc.deleteCategory);

router.get('/suppliers',           requirePermission('supplier.view'),           pc.listSuppliers);
router.get('/suppliers/:id',       requirePermission('supplier.view'),           pc.getSupplier);
router.post('/suppliers',          requirePermission('supplier.create'),         pc.createSupplier);
router.put('/suppliers/:id',       requirePermission('supplier.edit'),           pc.updateSupplier);

router.get('/equipment',           requirePermission('equipment.inventory_view'),   pc.listEquipment);
router.post('/equipment',          requirePermission('equipment.inventory_manage'), pc.createEquipment);
router.put('/equipment/:id',       requirePermission('equipment.inventory_manage'), pc.updateEquipment);

router.get('/locations',           requirePermission('part.view'),               pc.listLocations);
router.post('/locations',          requirePermission('settings.inventory'),      pc.createLocation);
router.put('/locations/:id',       requirePermission('settings.inventory'),      pc.updateLocation);

// ── Parts master (/:id MUST come after all specific paths) ──────────────────
router.get('/',                    requirePermission('part.view'),   pc.listParts);
router.post('/',                   requirePermission('part.create'), pc.createPart);
router.get('/:id',                 requirePermission('part.view'),   pc.getPart);
router.put('/:id',                 requirePermission('part.edit'),   pc.updatePart);
router.delete('/:id',              requirePermission('part.delete'), pc.deletePart);

module.exports = router;
