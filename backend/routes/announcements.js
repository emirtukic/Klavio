const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/roleCheck');
const ctrl = require('../controllers/announcementController');
const { log } = require('../controllers/activityController');

router.get('/',       auth, ctrl.getAll);
router.post('/',      auth, role('admin','super_admin','coach'), log('create', 'Obavijest'), ctrl.create);
router.put('/:id',    auth, role('admin','super_admin'), log('update', 'Obavijest'), ctrl.update);
router.delete('/:id', auth, role('admin','super_admin'), log('delete', 'Obavijest'), ctrl.remove);

module.exports = router;
