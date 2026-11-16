const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const pro = requirePlan('pro');

router.get('/financial',       auth, role('super_admin', 'admin'), pro, ctrl.getFinancialReport);
router.get('/attendance',      auth, role('super_admin', 'admin', 'coach'), pro, ctrl.getAttendanceReport);
router.get('/members',         auth, role('super_admin', 'admin'), pro, ctrl.getMemberReport);
router.get('/selection-stats', auth, role('super_admin', 'admin'), pro, ctrl.getSelectionStats);
router.get('/top-debtors',     auth, role('super_admin', 'admin'), pro, ctrl.getTopDebtors);
router.get('/members-growth',  auth, role('super_admin', 'admin'), pro, ctrl.getMembersGrowth);

module.exports = router;
