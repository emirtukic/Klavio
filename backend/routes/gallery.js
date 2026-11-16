const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const requirePlan = require('../middleware/requirePlan');
const ctrl = require('../controllers/galleryController');
const pro = requirePlan('pro');

router.get('/',       auth, pro, ctrl.getAll);
router.post('/',      auth, pro, ctrl.upload.single('photo'), ctrl.uploadPhoto);
router.delete('/:id', auth, role('admin','super_admin','coach'), pro, ctrl.remove);

module.exports = router;
