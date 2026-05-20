const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/activityController');

router.get('/platform', auth, role('super_admin'), ctrl.getAllPlatform);
router.get('/',         auth, role('admin','super_admin'), ctrl.getAll);

module.exports = router;
