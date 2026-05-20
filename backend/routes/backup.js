const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/backupController');

router.get('/export', auth, role('admin','super_admin'), ctrl.exportJSON);

module.exports = router;
