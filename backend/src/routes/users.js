const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  listUsers, getUser, createUser, updateUser,
  resetUserPassword, unlockUser,
  killUserSessions, listActiveSessions, killSession,
  listRoles, listPermissions, getUserStats,
} = require('../controllers/userController');

router.use(authenticate);

router.get('/roles',                               listRoles);
router.get('/permissions',                         requirePermission('users:view'), listPermissions);
router.get('/stats',                               requirePermission('users:view'), getUserStats);
router.get('/sessions',                            requirePermission('users:view'), listActiveSessions);
router.delete('/sessions/:sessionId',              requirePermission('users:edit'), killSession);

router.get('/',                                    requirePermission('users:view'),       listUsers);
router.get('/:id',                                 requirePermission('users:view'),       getUser);
router.post('/',                                   requirePermission('users:create'),     createUser);
router.put('/:id',                                 requirePermission('users:edit'),       updateUser);
router.post('/:id/reset-password',                 requirePermission('users:edit'),       resetUserPassword);
router.post('/:id/unlock',                         requirePermission('users:edit'),       unlockUser);
router.delete('/:id/sessions',                     requirePermission('users:edit'),       killUserSessions);

module.exports = router;
