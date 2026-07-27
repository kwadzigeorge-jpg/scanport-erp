const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const mc = require('../controllers/marshalController');

router.use(authenticate);

const VIEW   = requirePermission('marshal.view');
const MANAGE = requirePermission('marshal.manage');

// Dashboard
router.get('/dashboard',                           VIEW,   mc.getDashboard);

// Gangs + members
router.get('/gangs',                               VIEW,   mc.listGangs);
router.get('/members',                             VIEW,   mc.listAllMembers);
router.get('/gangs/:gangId/members',               VIEW,   mc.listMembers);
router.post('/gangs/:gangId/members',              MANAGE, mc.addMember);
router.put('/gangs/:gangId/members/:memberId',     MANAGE, mc.updateMember);
router.delete('/gangs/:gangId/members/:memberId',  MANAGE, mc.deleteMember);

// Deployments
router.get('/deployments',                         VIEW,   mc.getDeploymentView);
router.post('/deployments',                        MANAGE, mc.createDeployment);
router.post('/deployments/:id/close',              MANAGE, mc.closeDeployment);
router.delete('/deployments/:id',                  MANAGE, mc.deleteDeployment);

// Attendance
router.patch('/attendance/:id/toggle',             MANAGE, mc.toggleAttendance);
router.patch('/attendance/:id/note',               MANAGE, mc.updateAttendanceNote);

// Overtime
router.get('/overtime',                            VIEW,   mc.getOvertimeReport);
router.post('/overtime',                           MANAGE, mc.recordOvertime);
router.delete('/overtime/:id',                     MANAGE, mc.removeOvertime);

module.exports = router;
