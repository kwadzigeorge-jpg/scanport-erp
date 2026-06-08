const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const pc = require('../controllers/permissionController');

router.use(authenticate);

// ─── Atomic permissions (read-only, seeded) ───────────────────────────────────
router.get('/atomic', requirePermission('permission.view'), pc.listPermissions);

// ─── Permission groups ────────────────────────────────────────────────────────
router.get('/groups',        requirePermission('permission.view'),         pc.listGroups);
router.post('/groups',       requirePermission('permission.group_manage'), pc.createGroup);
router.put('/groups/:id',    requirePermission('permission.group_manage'), pc.updateGroup);
router.delete('/groups/:id', requirePermission('permission.group_manage'), pc.deleteGroup);

// ─── Roles ────────────────────────────────────────────────────────────────────
router.get('/roles',              requirePermission('role.view'),   pc.listRoles);
router.get('/roles/:id',          requirePermission('role.view'),   pc.getRole);
router.post('/roles',             requirePermission('role.create'), pc.createRole);
router.put('/roles/:id',          requirePermission('role.edit'),   pc.updateRole);
router.delete('/roles/:id',       requirePermission('role.delete'), pc.deleteRole);
router.get('/roles/:id/history',  requirePermission('role.view'),   pc.getRoleHistory);

// ─── User permission overrides ────────────────────────────────────────────────
router.get('/users/:userId/overrides',                requirePermission('permission.assign'), pc.getUserOverrides);
router.put('/users/:userId/overrides',                requirePermission('permission.assign'), pc.setUserOverride);
router.delete('/users/:userId/overrides/:overrideId', requirePermission('permission.assign'), pc.removeUserOverride);
router.get('/users/:userId/effective',                requirePermission('user.view'),          pc.getUserEffectivePermissions);

module.exports = router;
