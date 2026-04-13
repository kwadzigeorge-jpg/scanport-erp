const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  login, logout, me, forgotPassword, resetPassword, changePassword,
} = require('../controllers/authController');

// Public
router.post('/login',           login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// Protected
router.post('/logout',          authenticate, logout);
router.get('/me',               authenticate, me);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
