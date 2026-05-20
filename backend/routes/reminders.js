const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/reminderController');

router.post('/check-fees', auth, role('admin','super_admin'), ctrl.checkFees);

module.exports = router;
