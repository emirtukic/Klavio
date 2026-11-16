const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/activityController');

router.get('/platform', auth, role('super_admin'), ctrl.getAllPlatform);
router.get('/',         auth, role('admin','super_admin'), requirePlan('pro'), ctrl.getAll);

module.exports = router;
