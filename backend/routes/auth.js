const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.post('/forgot-password', ctrl.forgotPassword);
router.get('/validate-reset', ctrl.validateResetToken);
router.post('/reset-password', ctrl.resetPassword);
router.get('/verify-email', ctrl.verifyEmail);
router.get('/set-password', ctrl.validateSetPasswordToken);
router.post('/set-password', ctrl.setPassword);
router.get('/profile', auth, ctrl.getProfile);
router.put('/profile', auth, ctrl.updateProfile);
router.put('/club-branding', auth, role('admin', 'super_admin'), ctrl.updateClubBranding);
router.post('/profile/avatar', auth, ctrl.avatarUpload.single('avatar'), ctrl.uploadAvatar);
router.post('/change-password', auth, ctrl.changePassword);
router.post('/users', auth, role('super_admin', 'admin'), ctrl.createUser);

module.exports = router;
