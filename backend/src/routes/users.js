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
router.get('/permissions',                         requirePermission('user.view'), listPermissions);
router.get('/stats',                               requirePermission('user.view'), getUserStats);
router.get('/sessions',                            requirePermission('session.view'), listActiveSessions);
router.delete('/sessions/:sessionId',              requirePermission('session.manage'), killSession);

router.get('/',                                    requirePermission('user.view'),          listUsers);
router.get('/:id',                                 requirePermission('user.view'),          getUser);
router.post('/',                                   requirePermission('user.create'),        createUser);
router.put('/:id',                                 requirePermission('user.edit'),          updateUser);
router.post('/:id/reset-password',                 requirePermission('user.password_reset'),resetUserPassword);
router.post('/:id/unlock',                         requirePermission('user.unlock'),        unlockUser);
router.delete('/:id/sessions',                     requirePermission('user.session_kill'),  killUserSessions);

module.exports = router;
