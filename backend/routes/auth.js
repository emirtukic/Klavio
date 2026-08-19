const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');

// Throttle brute-force login/password-reset attempts per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Previše pokušaja. Pokušajte ponovo za nekoliko minuta.' }
});

router.post('/login', authLimiter, ctrl.login);
router.post('/register', authLimiter, ctrl.register);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.get('/validate-reset', ctrl.validateResetToken);
router.post('/reset-password', authLimiter, ctrl.resetPassword);
router.get('/verify-email', ctrl.verifyEmail);
router.get('/set-password', ctrl.validateSetPasswordToken);
router.post('/set-password', authLimiter, ctrl.setPassword);
router.get('/profile', auth, ctrl.getProfile);
router.put('/profile', auth, ctrl.updateProfile);
router.put('/club-branding', auth, role('admin', 'super_admin'), ctrl.updateClubBranding);
router.post('/profile/avatar', auth, ctrl.avatarUpload.single('avatar'), ctrl.uploadAvatar);
router.post('/change-password', auth, ctrl.changePassword);
router.post('/users', auth, role('super_admin', 'admin'), ctrl.createUser);

module.exports = router;
