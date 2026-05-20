const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');

router.get('/financial',       auth, role('super_admin', 'admin'), ctrl.getFinancialReport);
router.get('/attendance',      auth, role('super_admin', 'admin', 'coach'), ctrl.getAttendanceReport);
router.get('/members',         auth, role('super_admin', 'admin'), ctrl.getMemberReport);
router.get('/selection-stats', auth, role('super_admin', 'admin'), ctrl.getSelectionStats);
router.get('/top-debtors',     auth, role('super_admin', 'admin'), ctrl.getTopDebtors);
router.get('/members-growth',  auth, role('super_admin', 'admin'), ctrl.getMembersGrowth);

module.exports = router;
