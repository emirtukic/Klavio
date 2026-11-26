const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/reminderController');

router.post('/check-fees',        auth, role('admin','super_admin','coach'), ctrl.checkFees);
router.post('/send-fee/:feeId',   auth, role('admin','super_admin','coach'), ctrl.sendFeeReminder);

module.exports = router;
