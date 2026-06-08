const router = require('express').Router();
const { login, register, me, listUsers, deleteUser } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', authenticate, requireAdmin, register);
router.get('/me', authenticate, me);
router.get('/users', authenticate, requireAdmin, listUsers);
router.delete('/users/:id', authenticate, requireAdmin, deleteUser);

module.exports = router;
