const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/announcementController');

router.get('/',       auth, ctrl.getAll);
router.post('/',      auth, role('admin','super_admin','coach'), ctrl.create);
router.put('/:id',    auth, role('admin','super_admin'), ctrl.update);
router.delete('/:id', auth, role('admin','super_admin'), ctrl.remove);

module.exports = router;
